# 主从复制
> 核心作用：读写分离、数据备份、故障切换
> 原理：主库（master）写binlog，从库（slave）拉取binlog，重放sql实现数据同步；默认异步复制。
> 架构：1 主 1 从示例；主库负责写，从库负责读。
## 使用场景
✅ 适用场景
1. **读写分离**：NestJS 写请求走主库，查询请求走从库，分担主库压力
2. **数据热备份**：从库实时同步，主库宕机可提升从库为主
3. **数据分析 / 报表**：复杂统计查询丢从库，不影响线上业务
4. **灰度、数据迁移**
❌ 不适用
- 强一致性场景（异步复制存在短暂延迟）
- 跨机房极高可用（需要 MGR / 主从 + 哨兵）
## 环境准备（docker一键搭建主从）
```yaml
version: '3.8'
services:
  mysql-master:
    image: mysql:8.0
    container_name: mysql-master
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: Master@123456
    volumes:
      - ./master.cnf:/etc/mysql/conf.d/master.cnf
    restart: always
    command: --default-authentication-plugin=mysql_native_password

  mysql-slave:
    image: mysql:8.0
    container_name: mysql-slave
    ports:
      - "3307:3306"
    environment:
      MYSQL_ROOT_PASSWORD: Slave@123456
    volumes:
      - ./slave.cnf:/etc/mysql/conf.d/slave.cnf
    restart: always
    command: --default-authentication-plugin=mysql_native_password
```
master.cnf
```ini
[mysqld]
server-id = 1 # 主库必须等于1
log-bin = mysql-bin
binlog-format = ROW
# 不需要同步的库（可选）
binlog-ignore-db = mysql
```
slave.cnf
```ini
[mysqld]
server-id = 2
relay-log = relay-bin
read_only = ON
super_read_only = ON
```
- `reply-log`:中继日志，从库存放拉取到的binlog
- `read_only`:普通用户只读，`super_read_only`:root也只读（防误写）
启动容器`docker-compose up -d`
## 主库配置操作
1.进入主库sql
```bash
docker exec -it mysql-master mysql -uroot -pMaster@123456
```
2.创建复制账号
```sql
CREATE USER 'repl'@'%' IDENTIFIED BY 'Repl@123456';
-- 授予复制权限
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';
FLUSH PRIVILEGES;
```
3.锁表，查看主库binlog位置（记录File、Position、后面从库要用）
```
FLUSH TABLES WITH READ LOCK;
SHOW MASTER STATUS;
```
> ⚠️ 不要关闭这个会话！一旦退出锁就释放。
> 记录：`File=mysql-bin.000001`，`Position=156`
> 如果已有业务数据，需要先dump全量备份，导入从库再开启主从

## 从库配置操作
1.进入从库sql
```bash
docker exec -it mysql-slave mysql -uroot -pSlave@123456
```
2.配置主库信息（替换下面FILE和POSITION为上面查到的值）
```sql
CHANGE MASTER TO
MASTER_HOST='mysql-master',
MASTER_USER='repl',
MASTER_PASSWORD='Repl@123456',
MASTER_LOG_FILE='mysql-bin.000001',
MASTER_LOG_POS=156;
```
3.启动从库复制
```sql
START SLAVE;
```
4.查看从库的状态 
```sql
SHOW SLAVE STATUS\G
```
✅ 成功标志：
```
Slave_IO_Running: Yes
Slave_SQL_Running: Yes
```
> 回到主库窗口，执行解锁
```sql
UNLOCK TABLES;
```
5.测试主从同步

主库执行：
```sql
CREATE DATABASE test_db;
USE test_db;
CREATE TABLE user(id INT PRIMARY KEY AUTO_INCREMENT,name VARCHAR(20));
INSERT INTO user(name) VALUES('张三');
```

去从库查询：
```sql
USE test_db;
SELECT * FROM user;
```

# 重要注意事项

1. **复制延迟**：异步主从存在延迟，写入后立刻查从库可能读不到最新数据；新增数据后立刻读取用 `useMaster:true`
2. 主键自增：一主多从集群，主库自增 id 要设置步长，避免 ID 冲突（单机 1 主 1 从不用）
3. DDL 大表变更：会造成主从延迟，业务低峰操作
4. 从库只读：业务代码禁止写从库，由`read_only`兜底
5. 故障：`Slave_SQL_Running` 报错，一般是数据不一致；可以跳过错误或者重建主从
6. 高可用：原生主从没有自动故障转移，需要**MGR、Keepalived、Orchestrator**做主从切换


## GTID （Global Transaction Identifier）
> GTID即全局事务ID （Global Transaction Identifier），其保证每个主节点上提交的事务，在从节点可以一致性的复制。



## 自动故障切换
> 两个完全独立路线，二选一：
> 1）**传统半同步主从 + Orchestrator + Keepalived（或 ProxySQL）**（互联网最主流，你前面 Nest 读写分离这条线）
> 2）**MGR（InnoDB Cluster）**（官方原生高可用，强一致，复杂度高）
### 方案 1：半同步主从 + Orchestrator + Keepalived
架构：1 主 2 从（独立物理机 / 云主机），GTID + 增强半同步

1. MySQL：传统主从复制（ROW+GTID+`AFTER_SYNC`半同步）
2. Orchestrator：监控所有 MySQL 实例；主宕机自动选出数据最新从库提升新主，**自动修改其余从库的主从关系**
3. Keepalived：跑在每台 MySQL 机器，维护 VIP；Orchestrator 的`PostFailoverProcesses`钩子脚本触发 VIP 飘到新主
4. NestJS 业务：TypeORM 的 master 地址写**VIP**，不是真实 IP；读节点可以直连从库或者走 ProxySQL 做读写分离

优点
- 成熟、运维 DBA 上手快；读写分离天然支持；对 Nest 业务零侵入；故障切换 RTO 10~30 秒
- 支持复杂拓扑：级联复制、多从库、在线优雅切换（版本升级）
缺点
- 异步 / 半同步，极端宕机场景**有极小概率丢数据**；网络分区会有脑裂风险，需要 STONITH（关机 / 隔离旧主）
- Orchestrator 自身是单点，生产要部署 Orchestrator Raft 三节点集群

### 方案 2：半同步主从 + Orchestrator + ProxySQL（推荐替代 Keepalived，云环境更友好）
> 去掉 Keepalived，用 ProxySQL 做数据库流量网关：
- NestJS**只连 ProxySQL 一个地址**；ProxySQL 后端维护主 / 从节点列表
- Orchestrator 故障切换完成后，调用 ProxySQL API 更新后端节点，自动把新主设为写节点
- 半同步，主执行事务，写入binlog，至少等1个从拿到 binlog，才返回客户端事务成功
> 增强半同步 `rpl_semi_sync_master_wait_for_slave_count=1` ;订单、用户、支付这类核心业务，自动故障切换场景**必须增强半同步**。
✅优势：云服务器很多不支持 VRRP/Keepalived，ProxySQL 无 VIP，云原生更友好；同时天然做读写分离、连接池、限流。**这个现在越来越主流**

### 方案 3：MGR（InnoDB Cluster，官方原生高可用）

MGR 不是传统 binlog 主从，底层 Paxos 协议，**3 节点推荐**，自动成员管理、自动故障选主。

- InnoDB Cluster = MGR + MySQL Router（内置路由，替代 VIP）
- 事务提交必须过半节点确认，**RPO≈0，数据丢失风险远低于传统主从**
- 读写分离：MGR 主节点写，其他成员只读

✅优点：官方原生，不需要第三方故障切换工具（不需要 Orchestrator/MHA），自动自愈
❌缺点：写入有网络往返开销，高并发写入性能下降；DDL、大事务容易触发组阻塞；运维门槛更高；**不适合超大事务**
> 适合：金融、支付、订单核心链路，强数据一致性要求，业务写入量不是极端高

### 方案 4：最简单小业务：主从 + Keepalived（无 Orchestrator）

Keepalived 只漂移 VIP；**主宕机 VIP 飘到备库，但不会自动修复主从拓扑，需要人工改 CHANGE MASTER**，只能做简单一主一备，**不能自动故障切换**，只适合小型项目。

✅ 生产标准：**每个 MySQL 实例独立宿主机**；多可用区部署更好（云厂商跨 AZ）。
可以一台机器跑多个**从库实例**，但**主库不能和任何从库在同一台机器**。

### VIP漂移
> Keepalived 核心就是做 **VIP（虚拟 IP）漂移**；它**完全不懂 MySQL、不懂 binlog、不懂主从复制**，只管网络层面的 IP。

#### 1、什么是 VIP 虚拟 IP (Virtual IP)
通机器每个网卡有**真实物理 IP**，例如：
- 主机 A 真实 IP：`10.0.0.10`（主库 MySQL 跑这里）
- 主机 B 真实 IP：`10.0.0.11`（备库 MySQL 跑这里）
**VIP 是一个额外的、不属于任何一台机器网卡的 IP 地址**，比如 `10.0.0.100`。
这个 IP 可以在**同一局域网内，在多台机器之间来回移动**。

业务 (NestJS、后端程序、Java、PHP)**不去连真实机器 IP，只连 VIP：10.0.0.100:3306**。
类比：
> 公司对外公开总机号码是 `888888`（VIP）。
> 这个号码可以接在工位 A 电话上，也可以切到工位 B 电话。员工 A、B 各自有自己分机号（真实物理 IP）。
> 外部客户永远只打总机 `888888`，不需要知道现在是谁在接电话。
#### 2.漂移是什么意思（漂移 = 迁移虚拟 IP）
正常状态

VIP `10.0.0.100` **绑定在主库机器 A (10.0.0.10)** 的网卡上。
所有数据库连接（Nest）访问 `10.0.0.100:3306` → 流量落到机器 A 的 MySQL 主库。

Keepalived 会互相心跳：B 机器每隔几秒检测 A 机器是否存活。

故障场景：机器 A 宕机，MySQL 主库挂掉

Keepalived 检测到 A 机器心跳失联。
👉 **漂移：把 VIP `10.0.0.100`，从机器 A 解绑，绑定到备库机器 B (10.0.0.11) 网卡上。**

### 主从延迟原因：
- 主库大事务；
- 从库单线程回放；
- 网络 IO；从库硬件弱。

### 复制模式
- 异步复制
- 半同步复制
- 组复制 MGR