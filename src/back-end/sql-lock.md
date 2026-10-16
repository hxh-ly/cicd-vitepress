---
outline: [2, 3]
---

# SQL 锁机制
![lock.png](img/lock.png)
事务、MVCC、索引及日志等内容见 [SQL](./sql.md)。

阅读顺序：**分类概览 → 按维度理解锁 → 典型锁示例 → 死锁案例与排查 → 锁的观测 → 面试问答**。

## 分类概览

以下以 **MySQL 8.0/8.4、InnoDB** 为主要背景。锁的分类不是一张互斥清单：同一次操作可以同时具有多个属性。例如，主键等值命中的 `SELECT ... FOR UPDATE`，可以同时描述为“悲观并发控制、行级锁定、X 排他模式、Record Lock”，并伴随表级 IX 和 Server 层 MDL。

- **按保护范围**：全局锁、表级锁、行级锁。
- **按访问模式**：S 共享、X 排他；多粒度协调还有 IS、IX 意向模式。
- **按索引覆盖区间**：记录锁、间隙锁、临键锁；插入操作涉及插入意向锁。
- **按保护对象/用途**：数据锁、元数据锁 MDL、自增值分配相关锁。
- **按业务并发策略**：悲观锁、乐观锁；后者不是 InnoDB 的一种独立锁类型。
- **按使用方式**：显式请求锁定、由 SQL 操作自动加锁；按等待策略又可选择默认等待、NOWAIT、SKIP LOCKED。

### 实验准备与执行方式

在独立测试库中创建下表，不要对生产表执行实验。使用两个连接 A、B；标有“等待”的 B 语句执行后，切回 A 释放锁，再回 B 清理事务。**各小节独立实验，结束时两边都执行 ROLLBACK，避免插入和修改影响下一节。** 默认所有实验都没有第三个事务干扰。

```sql
CREATE TABLE lock_demo (
  id INT PRIMARY KEY,
  stock INT NOT NULL,
  version INT NOT NULL DEFAULT 0
) ENGINE = InnoDB;

INSERT INTO lock_demo (id, stock) VALUES (10, 100), (20, 100), (30, 100);

-- A、B 各自在未开启事务时执行 设置**当前数据库会话**的**事务隔离级别**为：**REPEATABLE‑READ（可重复读，简称 RR）**，这是 MySQL InnoDB **默认隔离级别**。
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

## 按维度理解锁

### 维度一：保护范围——全局、表级、行级

#### 全局读锁

**全局读锁**：影响整个 MySQL 实例的数据写入等操作，常见于备份协调；并不阻止所有查询。下面只展示获得与释放，不把它作为日常业务锁：

```sql
-- 独立管理连接；需要相应权限
FLUSH TABLES WITH READ LOCK;
-- 此连接保持期间，其他连接的数据写入等操作受阻
UNLOCK TABLES;
```

#### 显式表锁

**显式表锁**：保护整张表。READ 允许其他会话读、阻止写；WRITE 阻止其他会话访问该表。对于 InnoDB，按下面的事务与释放方式演示，READ、WRITE 两段分开运行：

```sql
-- 示例一：表读锁
SET autocommit = 0;
LOCK TABLES lock_demo READ;
SELECT * FROM lock_demo;
-- 当前连接不能写；其他连接可读，写入等待
COMMIT;
UNLOCK TABLES;
SET autocommit = 1;

-- 示例二：表写锁
SET autocommit = 0;
LOCK TABLES lock_demo WRITE;
UPDATE lock_demo SET stock = stock - 1 WHERE id = 20;
-- 当前连接可读写；其他连接访问该表受阻
ROLLBACK;
UNLOCK TABLES;
SET autocommit = 1;
```

`LOCK TABLES` 会隐式提交当前连接已有事务，不能随意插入业务事务；表锁实验期间也不要用 BEGIN 代替上面的流程。Server 层表锁与 InnoDB 内部锁、MDL 会共同参与，不要把观测到的所有等待都归因于一种锁。[显式表锁说明](https://dev.mysql.com/doc/refman/8.4/en/lock-tables.html)、[全局读锁说明](https://dev.mysql.com/doc/refman/8.4/en/flush.html)

#### 行级锁

**行级锁**：更细粒度地保护索引记录和相关区间，可以让不同事务并发操作不同记录：

```sql
-- A
BEGIN;
SELECT * FROM lock_demo WHERE id = 20 FOR UPDATE;

-- B
BEGIN;
UPDATE lock_demo SET stock = stock - 1 WHERE id = 30; -- 可执行
UPDATE lock_demo SET stock = stock - 1 WHERE id = 20; -- 等待 A

-- 切回 A：ROLLBACK; 然后 B：ROLLBACK;
```

行级不等于只锁 WHERE 最终返回的行，扫描路径会影响锁定范围。没有合适索引可能扫描并锁住大量记录/间隙，**InnoDB 不会因此自动升级成一个表锁**。页锁是其他引擎/系统中也会见到的粒度，不是这里 InnoDB SQL 事务锁的主要分类；内部页 latch 也不能混同于事务行锁。

### 维度二：访问模式——S、X、IS、IX

#### 为什么需要意向锁（多粒度协调问题）

假设没有意向锁，一个事务要给某一行加`X行锁`,另一个事务要加`X表锁`
- 表锁事务要判断「表内有没有行被锁住」，就必须**扫描整张表，逐行检查每一行有没有行锁**。
- 表越大，这个扫描成本越不可接受。
意向锁的解决方案：
> 当事务准备对行加锁，先自动对表加上一个意向信号；这样后来的表锁请求只需要看一眼表上的意向锁，就能立即判断加不加，不用扫描所有行
> 关键点：意向锁上表锁，InnoDB自动加，我们写SQL不需要主动声明。

|锁	|中文|	粒度|	作用|
|---|---|---|---|
|S|	共享锁|	行 / 表|	可读不可写，多事务可同时持 S|
|X|	排他锁|	行 / 表|	可读写，与其他 S/X 全互斥|
|IS|	意向共享锁|	表级|	事务准备在表内某些行加 S 锁|
|IX|	意向排他锁|	表级|	事务准备在表内某些行加 X 锁|
> InnoDB里表级没有直接到S/X表锁（LOCK TABLES是另一套会话锁） InnoDB的表级锁主要是IS/IX 意向锁。业务DML/`for update`自动挂IX

#### S / X：共享与排他

**S 共享锁**：同一记录允许多个事务持有 S；与该记录的 X 冲突。**X 排他锁**：与同一记录的 S、X 都冲突。这里的冲突针对加锁访问；普通 MVCC 快照读通常仍能读取可见版本。

```sql
-- A：表上自动取得 IS，id=20 上取得 S 记录锁
BEGIN;
SELECT * FROM lock_demo WHERE id = 20 FOR SHARE;

-- B：同一记录的 S 与 S 兼容
BEGIN;
SELECT * FROM lock_demo WHERE id = 20 FOR SHARE;
-- 换成修改，需要 X，因 A 的 S 而等待
UPDATE lock_demo SET stock = stock - 1 WHERE id = 20;

-- A：ROLLBACK; B 等待结束后：ROLLBACK;
```

#### UPDATE 自动加锁流程

以 `UPDATE t SET xxx WHERE id = 1` 为例：
```
事务T执行 update
   │
   ├─ 1. 自动在表上加 IX 意向排他锁   ← 表级，自顶向下
   │
   ├─ 2. 走到主键索引，命中 id=1 那一行
   │
   └─ 3. 给该行加 X 排他行锁          ← 行级，自底向上定位
```
另一个事务想给整张表加 **S 表锁** 时：

- 只需检查表上的意向锁 → 发现有 **IX** → 与 S 表锁**冲突** → 阻塞。
- 整个过程**不用扫描任何一行**。

#### IS / IX：意向锁与兼容性

**IS / IX 是表级意向锁**：加行级 S 前先取得 IS 或更强的意向锁；加行级 X 前先取得 IX。由引擎自动管理，不需要写 `LOCK ... IX`。IX 并不等于整表 X：

```sql
-- A：表级 IX + id=20 的 X
BEGIN;
SELECT * FROM lock_demo WHERE id = 20 FOR UPDATE;

-- B：也取得表级 IX，但锁的是 id=30，可执行
BEGIN;
SELECT * FROM lock_demo WHERE id = 30 FOR UPDATE;

-- A、B 分别 ROLLBACK;
```

IS 与 IS/IX、IX 与 IX 相互兼容；是否冲突还要看具体行锁。整表 S 与 IX 冲突，整表 X 与 IS/IX 都冲突。意向锁让整表锁申请可以在表级发现冲突，不必逐项检查全部行锁。

### 维度三：索引区间——记录、间隙、临键、插入意向

初始主键值为 10、20、30，先区分以下三个范围：

```text
记录锁：    {20}       只保护已有的索引记录
间隙锁：    (10,20)    保护两个索引记录之间的插入位置
临键锁：    (10,20]    前面的间隙 + 右端索引记录
```

#### 记录锁 Record Lock

**记录锁 Record Lock**：完整唯一索引等值命中已有记录，是典型的纯记录锁场景：

```sql
BEGIN;
SELECT * FROM lock_demo WHERE id = 20 FOR UPDATE;
-- 主键 20 的 X 记录锁；不因这把锁阻止插入 15
ROLLBACK;
```

#### 间隙锁 Gap Lock

**间隙锁 Gap Lock**：主要阻止往被保护的间隙插入数据，间隙两端记录不在这个锁的保护范围。RR 下，唯一索引等值查询不存在的 15，可用来观察间隙保护：

```sql
-- A：15 不存在，保护其所在间隙 (10,20)
BEGIN;
SELECT * FROM lock_demo WHERE id = 15 FOR UPDATE;

-- B
BEGIN;
INSERT INTO lock_demo (id, stock) VALUES (15, 100); -- 等待 A

-- A：ROLLBACK; B 插入完成后：ROLLBACK;
```

多个事务的纯 gap 锁可以共存，不能套用记录 S/X 的互斥规则。RC 通常不为搜索和索引扫描加 gap 锁，但外键检查、重复键检查等仍有例外，不能说 RC 绝无间隙锁。

#### 临键锁 Next-Key Lock

**临键锁 Next-Key Lock**：记录锁和记录前的间隙结合。RR 范围锁定读通常需要保护记录及可插入区间：

```sql
-- A：升序扫描主键区间，保护范围中的记录与间隙
BEGIN;
SELECT * FROM lock_demo FORCE INDEX (PRIMARY)
WHERE id > 10 AND id <= 20 ORDER BY id FOR UPDATE;

-- B
BEGIN;
INSERT INTO lock_demo (id, stock) VALUES (15, 100); -- 等待 A

-- A：ROLLBACK; B：ROLLBACK;
```

这个例子用于观察插入被阻止，不宣称所有版本和执行计划的完整锁集合都恰好是 `(10,20]`。实际边界、是否退化成记录锁/间隙锁，需结合执行计划及 `data_locks` 查看。普通 RR SELECT 通常走 MVCC，而不是每次都加临键锁。

#### 插入意向锁 Insert Intention Lock

**插入意向锁 Insert Intention Lock**：插入前对目标间隙申请的一种锁，与表级 IX 不是同一件事。不同插入位置通常可以并行，但会被已有 gap/next-key 锁阻挡：
> 一种特殊的间隙锁。转供‘insert’使用。多个事务只要往不同的间隙插入数据，就能并发执行，互不阻塞；但它会被一存在的普通间隙锁/领键锁挡住。

**为什么需要插入意向锁？**

**误区：区间不重叠 ≠ 锁不冲突。**

锁是否冲突，由锁类型的兼容性决定，不是由“区间是否重叠决定”
- 同样的两个不同间隙 `(1,5)`、`(5,10)`：
  - 若用的是**普通间隙锁** → 互斥 → 串行
  - 若用的是**插入意向锁** → 兼容 → 并行
- 间隙没变，变的只是锁的 "类型"。
> 所以插入意向锁存在的意义**不是区分间隙**（间隙本来就是分开的），而是**给 "插入请求" 专门定制一个互相兼容的锁类型**。

普通间隙锁的 "缺点"
- 普通间隙锁是**互斥**的：事务 A 锁住一个间隙，事务 B 想插同一区间就得等。
- 但问题是：如果两个事务**插到完全不同的间隙**，本来可以并行 —— 用普通间隙锁就**白白串行化**了。
插入意向锁的 "改进"
- 插入意向锁放宽了限制：**同样都是 "准备插入" 的锁，彼此之间不互斥。**
- 只要插入位置落在**不同的间隙**，就**同时插入、互不等待**，大幅提升并发。

```sql
-- 没有前述 A 的间隙锁时，分别在两个连接执行
-- A
BEGIN;
INSERT INTO lock_demo (id, stock) VALUES (15, 100);

-- B：同处 (10,20) 的原始间隙，但不同位置，通常不需等 A
BEGIN;
INSERT INTO lock_demo (id, stock) VALUES (16, 100);

-- A、B 分别 ROLLBACK;
```

若 A 先执行前面的 `id=15 FOR UPDATE` 空结果查询，B 的插入就会等待，等待锁模式可能包含 `INSERT_INTENTION`。若两个事务插入同一唯一键，还会受到唯一性检查相关锁的影响，不能理解为所有 INSERT 都互不阻塞。

### 维度四：保护对象——数据、元数据、自增分配

#### 数据锁与元数据锁 MDL

**数据锁**保护行数据及索引区间，上面的 FOR UPDATE、UPDATE 就是示例。**MDL 元数据锁**保护表定义：读写表时自动取得相应 MDL，防止事务使用表的过程中，表结构被不兼容地修改。

```sql
-- A：普通 SELECT 不加数据行锁，也会取得表的 MDL
BEGIN;
SELECT * FROM lock_demo WHERE id = 20;
-- 保持事务未结束

-- B：DDL 需要相应 MDL，可能等待 A
SET SESSION lock_wait_timeout = 5;
ALTER TABLE lock_demo ADD COLUMN note VARCHAR(50);
-- 让本实验中的等待超时，或切回 A 提交后让 DDL 完成

-- A：ROLLBACK;
```

DDL 在需要排他的 MDL 阶段会受阻，即使支持在线 DDL 也不代表完全无锁。若 B 的 ALTER 成功，新增列不会因为事后 ROLLBACK 撤销；这与前面的可回滚数据修改实验不同。[MDL 官方说明](https://dev.mysql.com/doc/refman/8.4/en/metadata-locking.html)

#### 自增值分配 AUTO-INC

**AUTO-INC** 用于协调自增值分配，具体是否采用语句级表锁取决于模式和 INSERT 类型，不是所有 INSERT 都持有整表 AUTO-INC 锁：

```sql
SELECT @@innodb_autoinc_lock_mode;

CREATE TABLE auto_lock_demo (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  label VARCHAR(30)
) ENGINE = InnoDB;

INSERT INTO auto_lock_demo (label) VALUES ('A'), ('B');
SELECT LAST_INSERT_ID();
```

模式 0 采用传统 AUTO-INC 表锁；模式 1 区分可预知数量的简单插入和批量插入；模式 2 为交错模式，不使用这种表级 AUTO-INC 锁。MySQL 8.0/8.4 默认模式为 2。自增值可能有空洞，不能用是否连续判断事务是否成功；这里的语句级分配机制也不同于通常持有至事务结束的记录锁。[自增处理说明](https://dev.mysql.com/doc/refman/8.4/en/innodb-auto-increment-handling.html)

### 维度五：业务并发策略——悲观锁与乐观锁
> 悲观锁：事前防；
> 乐观锁：事后查
#### 悲观策略：先锁定再修改

**悲观策略**：先锁定，再检查与修改。例如扣库存：
行锁
> 其他数据库写法 for update;lock in share mode; update/delete/insert; RR还有邻键锁和间隙锁。跨节点使用redis分布式（SETNX+过期时间）
```sql
BEGIN;
SELECT stock FROM lock_demo WHERE id = 20 FOR UPDATE;  --- X行锁
UPDATE lock_demo SET stock = stock - 1 WHERE id = 20 AND stock >= 1;
SELECT ROW_COUNT(); -- 1：扣减成功；0：库存不足
COMMIT;
```

如果只是单条条件扣减，直接执行这个 UPDATE 通常已经能原子判断并扣减；先 SELECT FOR UPDATE 更适合锁定后还需要多步业务检查的情况。

redis分布式锁
```js
// 伪代码：SETNX + 过期时间
const lock = await redis.set('lock:stock:1', 'owner', 'EX', 10, 'NX');
if (lock) {
  try {
    await updateStock();
  } finally {
    await redis.del('lock:stock:1');
  }
} else {
  // 获取锁失败，处理
}
```

#### 乐观策略：版本条件更新

**乐观策略**：读取时不预先持有行锁，更新时用版本条件判断数据是否仍符合预期。业务要检查影响行数：
方式 1：版本号 version（最常用）
```sql
-- 表结构：t_user(id, balance, version)
-- 1. 先查，拿到当前版本
select id, balance, version from t_user where id = 1;  -- 得到 version = 5
-- 2. 更新时带上 version 条件，且 version 加 1
update t_user
set balance = balance - 100,
    version = version + 1
where id = 1 and version = 5;
select ROW_COUNT();
```
- 若`affected rows=1` -> 成功，说明期间没人改过（version=5）
- 若 `affected rows = 0` → 失败，说明期间别人把 version 改成了 6，本次更新没生效 → **重试**（重新查 version 再更新）。
> 关键：`where id=? and version=?` 这一条件就是 "乐观" 的核心 ——**用 version 做并发检测**。

方式 2: CAS（无条件更新+条件判断）
> 用数据库值，可能出现A -> B -> A ，导致误判
```sql
update t_user
set balance = balance - 100
where id = 1 and balance >= 100;   -- 用余额本身做条件
```

所有相关写入路径都要遵守版本递增约定。失败后由业务选择重新读取并有限重试，或告知冲突。**乐观锁不等于数据库 UPDATE 不加锁**，实际写入依然需要 InnoDB 数据锁；乐观/悲观描述的是业务处理冲突的策略。

#### 比较
|维度|	乐观锁|	悲观锁|
|---|---|---|
|思想	|冲突事后检测|	冲突事前预防|
|是否加锁|	不加锁（无锁）	|加锁（行锁 / 分布式锁）|
|冲突判断|	version / CAS 条件|	锁互斥（阻塞）|
|并发度|	高（无锁不阻塞）|	低（互相阻塞）|
|性能|	冲突少时性能好|	冲突多时可能更好（避免频繁重试）|
|缺点|	冲突频繁时要重试，可能饿死|	加锁开销、死锁风险、锁等待|
|适用|	读多写少、冲突概率低|	写多、冲突概率高、必须强一致|
|数据库实现|	version 字段 / CAS|	for update、update/delete 当前读|
|代码实现|	版本号校验、CAS	|synchronized、Redis 分布式锁|

#### 场景
|业务场景|	推荐|	原因|
|---|---|---|
|下单扣库存、转账、抢购|	悲观锁|	冲突概率高，需强一致，锁定保证不超卖|
|点赞、评论数、阅读量|	乐观锁（或直接不锁 / 原子自增）|	读多写少，冲突低，无锁高并发|
|用户资料编辑|	乐观锁（version）|	极少冲突，避免长时间持锁|
|分布式系统多个节点写同一资源|	分布式锁（悲观） 或乐观锁（version+CAS）|	单机行锁跨节点无效|
> 冲突概率高 → 悲观锁（省去反复重试）
> 冲突概率低但重试成本也低 → 乐观锁（省去加锁开销）
> 数据库有行锁加持时，单机场景乐观锁往往够用；跨节点 / 跨服务才需要分布式锁。

### 维度六：显式请求与自动加锁，以及等待策略

#### 显式请求与自动加锁

**显式请求锁定**：SQL 明确表达锁定意图；**自动加锁**：引擎为完成写入自行取得必要的锁。这里是 SQL 使用层面的分类，不展开 InnoDB 内部“隐式记录锁”的实现术语。

```sql
BEGIN;
SELECT * FROM lock_demo WHERE id = 20 FOR UPDATE; -- 显式请求锁定读
ROLLBACK;

BEGIN;
UPDATE lock_demo SET stock = stock - 1 WHERE id = 20; -- 自动加必要的锁
ROLLBACK;
```

#### 等待策略：NOWAIT 与 SKIP LOCKED

等待策略不改变保护对象，也不是新的锁粒度。A 已锁住 20 时，B 可以选择立即报错或跳过被锁记录：

```sql
-- A
BEGIN;
SELECT * FROM lock_demo WHERE id = 20 FOR UPDATE;

-- B，单独执行实验一
BEGIN;
SELECT * FROM lock_demo WHERE id = 20 FOR UPDATE NOWAIT; -- 不等待行锁，报错
ROLLBACK;

-- B，单独执行实验二
BEGIN;
SELECT * FROM lock_demo WHERE id IN (20, 30) FOR UPDATE SKIP LOCKED;
-- 跳过已被 A 锁住的 20，可取得 30；本次查询结果不完整
ROLLBACK;

-- A：ROLLBACK;
```

NOWAIT / SKIP LOCKED 针对行级锁等待，不承诺跳过 MDL 等所有等待。SKIP LOCKED 适合竞争领取任务等场景，不适合要求完整一致结果的普通业务查询。[锁定读说明](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)

## 典型锁的详细示例

### 行锁

> InnoDB 的数据行锁作用于索引记录；没有合适索引时可能扫描并锁住大量记录和间隙，但不会自动升级成表锁。
> 行级锁定涉及记录、间隙、临键等范围；RC 通常不为搜索扫描加间隙锁，外键检查和重复键检查等仍有例外。
> 实际锁范围取决于索引、扫描路径、隔离级别及语句类型，不能只看最终返回的行。

#### 共享与排他模式

1. S共享锁（读锁）：`SELECT ... LOCK IN SHARE MODE`
> 多个事务可以同时加S锁；不能加X写锁
2. X排他锁（写锁）：`SELECT ... FOR UPDATE`  /UPDATE /DELETE 自动加X锁
> 同一记录的 X 与其他事务的 S/X 冲突；普通 MVCC 快照读通常不受该记录锁阻塞。
可复现例子(两个会话窗口)
```sql
-- 会话A
SET SESSION transaction_isolation = 'REPEATABLE-READ';
START TRANSACTION;
-- 使用开头创建的 lock_demo；主键等值命中已有记录
SELECT * FROM lock_demo WHERE id = 20 FOR UPDATE;
-- 不commit，锁保持

-- 会话B
START TRANSACTION;
-- 等待：会话 A 持有 id=20 的 X 记录锁
UPDATE lock_demo SET stock = stock - 1 WHERE id = 20;

-- 切回会话 A 执行 COMMIT；B 的 UPDATE 完成后也需提交或回滚
COMMIT;
```
**如果 WHERE 缺少合适索引，可能扩大锁定范围，不是自动升级表锁。**
```sql
-- stock 无索引，扫描范围可能扩大（以 RR 为例）
START TRANSACTION;
UPDATE lock_demo SET stock = 90 WHERE stock = 100;
ROLLBACK;
```

### 表锁

> MyISAM 默认用表锁；InnoDB 优先行锁，**InnoDB 也可以手动显式加表锁**。
> 显式表锁粒度大，通常不作为高并发事务业务的常规选择。
区分：
1. **显式手动表锁**：`LOCK TABLES` 语法
2. **大范围行锁定**：没有合适索引时，扫描可能锁住大量记录与间隙；阻塞范围很大，但不应称为隐式表锁。

显式表锁使用 `LOCK TABLES`，下面分别演示读锁和写锁。

#### 读锁 READ

```sql
SET autocommit = 0;
LOCK TABLES lock_demo READ;
SELECT * FROM lock_demo;
COMMIT;
UNLOCK TABLES;
SET autocommit = 1;
```
- 当前对话可读表，不可写
- 其他会话可读，写入等待

#### 写锁 WRITE

```sql
SET autocommit = 0;
LOCK TABLES lock_demo WRITE;
UPDATE lock_demo SET stock = stock - 1 WHERE id = 20;
ROLLBACK;
UNLOCK TABLES;
SET autocommit = 1;
```
- 当前会话：可读可写
- 其他会话：**读、写全部阻塞**

#### 没有合适索引时的大范围锁定

```sql
create table t(id int primary key, name varchar(20));
insert t values(1,'a'),(2,'b'),(3,'c');

begin;
-- RR 下 name 无索引，可能扫描并锁住大量记录/间隙；不升级为表锁
select * from t where name='b' for update;
ROLLBACK;
```

### 记录锁

> 就是锁住索引中一条已经存在的记录，不包括它旁边的间隙，在业务可以理解成“锁住某一行”；底层锁的是索引记录。
```sql
CREATE TABLE orders (
  id INT PRIMARY KEY,
  status VARCHAR(20)
) ENGINE = InnoDB;

INSERT INTO orders VALUES
(10, 'pending'),
(20, 'pending'),
(30, 'pending');
```
怎样的操作会加记录锁？
```sql
BEGIN;

SELECT *
FROM orders
WHERE id = 20
FOR UPDATE;

-- 暂时不提交
```
这里满足三个条件
- id是主键，属于唯一索引
- 查询是id=20，精确定位
- 20这条记录确实存在
因此，对主键`20`加的是排他记录锁。锁范围可以理解成：
```
已有记录：10       20       30
                  🔒

锁住：{20}
不锁住：(10, 20) 或 (20, 30) 的间隙
```
此时其他事务执行
```sql
-- 等待：要修改被锁住的记录
UPDATE orders SET status = 'paid' WHERE id = 20;

-- 等待：要删除被锁住的记录
DELETE FROM orders WHERE id = 20;

-- 等待：要取得同一条记录的排他锁
SELECT * FROM orders WHERE id = 20 FOR UPDATE;
```
仅考虑上面的记录锁且无其他冲突时，下面的语句不会因此等待；请分别实验
```sql
-- 修改其他记录
UPDATE orders SET status = 'paid' WHERE id = 30;

-- 插入间隙中的新记录
INSERT INTO orders VALUES (15, 'pending');

-- 普通 SELECT，通过 MVCC 读取可见版本
SELECT * FROM orders WHERE id = 20;
```

### 间隙锁

> 锁住记录之间可以插入数据的位置
> RR 的范围锁定通常涉及间隙；RC 通常禁用搜索扫描的间隙锁，但外键和重复键检查等有例外。
例如锁住`(10,20)` 不包括两端
```
10                         20
●─────── 禁止插入 ──────────●
         11、15、19
```
这个锁的主要作用是：阻止其他事务往这个间隙插入新的索引记录。它本身不锁住 10 或 20，所以不能仅凭这个间隙锁阻止修改两端记录的普通非索引字段。

为什么要锁不存在的数据？因为虽然现在没有 15，其他事务却可能马上插入它。

### 临键锁 Next‑Key Lock（RR 级别）

>记录锁保护已有的索引记录；间隙锁保护记录之间的插入位置；临键锁同时保护某条记录和它前面的间隙，通常表示为左开右闭区间。它让 InnoDB 在可重复读下进行范围锁定读时，既防止已有记录被冲突修改，也防止其他事务向被保护的间隙插入新记录。
- 临键锁 = 记录锁 + 间隙锁 gap lock
- 作用：**RR 级别解决当前读幻读问题**
- 完整唯一索引等值命中已有记录时，通常只需要记录锁；查不到记录或仅匹配复合唯一索引的一部分不能照搬此结论。
- RR 范围锁定读通常涉及临键锁/间隙锁，阻止在被保护间隙中插入；普通 SELECT 通常使用 MVCC。
对索引记录`20`加邻键锁：
```
间隙锁：       (10, 20)
记录锁：            {20}
────────────────────────
临键锁：       (10, 20]
```
 也就是：
```
10                         20
●─────── 禁止插入 ──────────🔒
         11、15、19          记录也锁住
```
若是排他临键锁，它既能保护 20 这条记录，也能阻止其他事务在它前面的间隙插入新记录。这就是“记录锁 + 间隙锁”的含义

**为什么需要它？**

防止范围内凭空增加记录。假设事务A要锁住一个订单范围
```sql
BEGIN;

SELECT * FROM orders
WHERE id > 10 AND id <= 20
FOR UPDATE;
```
现在只查到 id = 20。

如果只锁住 20：
```
事务 A：锁住订单 20
事务 B：插入订单 15，并提交
事务 A：再次读取该范围，多了一条订单 15
```
所以范围锁定不仅要保护已有记录，还需要保护可能插入新记录的间隙。

**使用场景(什么时候容易碰到邻键锁)**
1. 悲观锁业务：`SELECT ... FOR UPDATE` 保护数据；是否需要临键锁取决于查找方式，不能仅凭 RR 判断。
2. `UPDATE / DELETE` 的范围扫描在 RR 下可能保护间隙，导致未直接修改的插入位置也被阻塞。
3. 并发高业务，**范围条件做 for update/update，容易锁很大范围，产生大量锁等待、死锁**。

## 死锁案例与排查

> 死锁定义：**两个或多个事务，互相持有对方需要的锁，又等待对方释放锁，循环等待，谁都无法继续执行**。

### 死锁的四个条件

1. **互斥**：资源同一时刻只能被一个事务占有（行锁互斥）
2. **持有并等待**：事务已经持有锁，再去申请新的锁
3. **不可剥夺**：锁不能被强行抢走，只能持有者主动释放
4. **循环等待**：事务 A 等 B 的锁，事务 B 等 A 的锁，形成等待环路

### 案例一：两行交叉更新

|事务T1|事务T2|
|---|---|
|`begin;`| |
|`update user set name=‘aa’ where id=1;`(持有T1排他锁)|`begin;`|
|| `begin;update user set name=‘aa’ where id=2;`(持有T2排他锁)|
|`update user set name=‘aa’ where id=2;` ||
|| `update user set name=‘aa’ where id=1;` |
- 持有对方需要的，又互相申请对方持有的
- 解决：两个事务都先操作id=1,在操作id=2

### 案例二：缺少索引导致锁定范围扩大

> 关键点：**where 条件没有索引，会锁住全表所有行，容易死锁。**
```sql
-- phone无索引
begin;
update user set name='x' where phone='13800000001';
```
- 解决：建立索引，让锁精确到行；

### 案例三：RR 下间隙锁与插入的冲突

```
表 user，主键 id，已有数据：`1,5,10`
索引间隙：`(-∞,1)、(1,5)、(5,10)、(10,+∞)`
```
> RR 级别下，普通 select for update，记录不存在会加间隙锁，容易出现死锁。
> 间隙锁是禁止别的事务的插入，持有的人不会阻塞
|T1	|T2|
|---|---|
|begin;|	begin;|
|select * from user where id=8 for update; id=8 不存在，锁住间隙 (5,10)	|
|	|select * from user where id=6 for update; id=6 不存在，也会申请间隙锁 (5,10)|
|insert into user (id) values (7); 等待	||
|insert into user (id) values (9); 等待	||
- 缓解：业务尽量降低隔离级别到 RC（读已提交），RC**没有间隙锁**，大幅减少死锁；
- 缓解：避免大量并发插入到同一个间隙区间。

### 排查：查看死锁日志

> ⚠️注意：死锁日志只保留**最近一次**死锁，新死锁会覆盖旧日志。
`show engine innodb status;` 里面打印`两个事务分别执行什么 SQL;各自持有什么锁，等待什么锁;哪个事务被回滚` 看 LATEST DETECTED DEADLOCK，拿到死锁 SQL，调整加锁顺序。

### 预防：减少死锁的实践

1. **统一访问表、行的顺序**：不要 A 事务锁 a 再锁 b，B 事务锁 b 再锁 a。
2. **尽量使用小事务**：减少事务内的操作，尽早提交，缩短锁持有时间。
3. **建立合适索引**：避免扫描并锁定大量记录。
4. **按业务语义选择隔离级别**：允许时考虑 RC，减少部分间隙锁冲突，但不能消除死锁。
5. **避免大范围锁定读**：谨慎使用范围条件的 `SELECT ... FOR UPDATE`。
6. **捕获死锁异常并有限重试**：重试整个事务。

### 处理：事务回滚与重试

检测到死锁环路，**回滚代价较小的事务**（undo 日志量少的），另一个事务继续运行。

> 开启死锁检测时，InnoDB 会选择一个事务作为牺牲者回滚，通常倾向较小事务；应用应对整个事务进行有限重试。

## 锁的观测与性能排查

### 从实际锁信息验证分类

在有权限的第三个连接中查询；将库名替换为实际测试库名：

```sql
SELECT ENGINE_TRANSACTION_ID, OBJECT_SCHEMA, OBJECT_NAME,
       INDEX_NAME, LOCK_TYPE, LOCK_MODE, LOCK_STATUS, LOCK_DATA
FROM performance_schema.data_locks
WHERE OBJECT_SCHEMA = '你的测试库名' AND OBJECT_NAME = 'lock_demo';

SELECT * FROM performance_schema.data_lock_waits;

SELECT OBJECT_SCHEMA, OBJECT_NAME, LOCK_TYPE, LOCK_DURATION, LOCK_STATUS
FROM performance_schema.metadata_locks
WHERE OBJECT_SCHEMA = '你的测试库名' AND OBJECT_NAME = 'lock_demo';
```

典型主键等值命中的 FOR UPDATE 会看到表级 `IX` 和记录级 `X,REC_NOT_GAP`。`RECORD` 只是底层锁类别，不能只凭 LOCK_TYPE 就认定是纯记录锁，还要结合 LOCK_MODE 的 GAP、REC_NOT_GAP、INSERT_INTENTION 等信息。MDL 在 metadata_locks 中观察，不要与 data_locks 的行锁混淆。[data_locks 说明](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-data-locks-table.html)

### 锁等待与慢查询

**事务 / 锁等待**：不是 SQL 本身慢，被锁阻塞，等待其它事务释放锁，执行时间被拉长，也会进入慢查询。

## 锁机制相关面试问答

### Q1：InnoDB RR 级别，到底有没有幻读？

> 
> 快照读（普通 select）：MVCC，看不到别的事务 insert，感受不到幻读；
> 当前读 (update/delete/select for update)：**临键锁（Next‑Key Lock）阻止插入，解决幻读现象**。

#### 快照读与当前读的补充

> 注意：RR 下 MVCC 只是快照读看不见幻读；**当前读 (update/for update) 幻读靠临键锁解决，MVCC 解决不了当前读幻读**。

### Q2：MVCC (多版本并发控制) 可以完全代替锁吗？

不行，MVCC 只针对快照读；update delete for update 是当前读，依旧需要锁。

### Q3：大事务有什么危害？

1. 锁持有时间长，更容易死锁、阻塞；
2. undo log、redo log 膨胀；
3. binlog 过大，主从复制延迟飙升；
4. 回滚时间长。

### Q4：千万级大表加字段，线上注意什么？

MySQL8.0 支持部分 DDL Online；老版本 alter 锁表；使用 pt‑online‑schema‑change /gh‑ost 在线 DDL 工具，避免锁表业务不可用。

### Q5：行锁、表锁、意向锁有什么区别？

1. **行级锁定**：实际索引范围受隔离级别、索引和执行计划影响；不能简单等同于 RC 只有记录锁、RR 只有临键锁。
2. **表锁**：lock tables；MyISAM 默认；InnoDB 很少手动使用
3. **意向共享 IS / 意向排他 IX**：表级意向锁，协调行锁与表锁，避免表锁判断扫描全部行。

### Q6：共享锁 S 与排他锁 X 有什么区别？

- S 共享锁：读锁，多个事务可同时加 S；不能加 X。`select … lock in share mode`
- X 排他锁：与同一记录上的其他 S/X 冲突，通常不阻塞普通快照读。`SELECT ... FOR UPDATE`、UPDATE/DELETE 会请求必要的 X 锁。

### 面试回答思路

**面试总结：** 先说明分类维度。行锁/表锁讲范围，S/X 讲访问模式，记录/间隙/临键讲索引区间，IS/IX 协调多粒度锁，MDL 保护表定义，乐观/悲观讲业务并发策略。同一 SQL 可涉及多个维度，实际锁范围还要结合隔离级别、索引和执行计划判断。

以上数据锁分类参考 [InnoDB 锁机制](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html)。
