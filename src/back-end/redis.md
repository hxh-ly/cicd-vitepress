## Redis

> Redis（Remote Dictionary Server），C 语言开发，**内存型 Key-Value 数据库**
> 因为 mysql 存在硬盘，并且会执行 sql 的解析，会成为系统的性能瓶颈，所以我们要做一些优化。
> 计算机领域最经常考虑到的性能优化手段就是缓存了。能不能把结果缓存在内存中，下次只查内存就好了呢
> 所以做后端服务的时候，我们不会只用 mysql，一般会结合内存数据库来做缓存，最常用的是 redis。
> 因为需求就是缓存不同类型的数据，所以 redis 的设计是 key、value 的键值对的形式。
> 并且值的类型有很多：字符串（string）、列表（list）、集合（set）、有序集合（sorted set)、哈希表（hash）、地理信息（geospatial）、位图（bitmap）等。

为什么快？

- **数据全部放内存**，没有磁盘 IO 开销；
- **命令执行单线程**（6.0 后是 IO 多线程，命令执行依旧单线程），无锁竞争、无上下文切换；注意执行命令的是单线程，不是redis是单线程
- IO 多路复用（epoll/kqueue），少量线程管理上万连接；
- 底层是高度优化的自定义数据结构；
- 简单 RESP 通信协议，解析开销小。

### 常见数据类型

1. `String`：字符串，最大 512MB；缓存、计数器（INCR）、分布式锁、session。
2. `Hash`：哈希表，适合存储对象（用户信息），不用序列化整段 JSON。
3. `List`：双向链表；简单队列、消息、最新消息列表。
4. `Set`：无序集合，自动去重；共同好友、黑名单、抽奖。
5. `ZSet(Sorted Set)`：有序集合，带 score；排行榜、延时队列。
   高级类型
   `Bitmap`(签到)、`HyperLogLog`(UV 统计，误差 0.81%)、`Geo`地理位置、`Stream`（可靠消息队列，支持 ACK，替代 Pub/Sub）

### Redis 过期键删除策略

**惰性删除 + 定期删除，两者配合**

1. **惰性删除**：key 过期不立刻删；**下次访问 key 时**，检查过期并删除。优点：省 CPU；缺点：过期 key 占内存。
2. **定期删除**：后台线程每隔一段时间，随机抽样一批 key，清理过期的；不能扫描全库，防止阻塞主线程。
   > 兜底：**内存淘汰策略**，内存满了主动删 key。

### 4. 内存淘汰策略（maxmemory-policy）

内存达到 maxmemory 上限，写新 key 时触发：

1. `noeviction`：默认，不淘汰，直接报错（生产缓存不推荐）
2. `volatile-lru`：从**带 TTL 的 key**中淘汰最近最少使用
3. `allkeys-lru`：**所有 key**中淘汰 LRU（缓存场景最常用）
4. `volatile-lfu`：过期 key，淘汰访问频率最低
5. `allkeys-lfu`：全部 key，LFU看访问频次（热点长期缓存推荐）
6. `volatile-random / allkeys-random`：随机删 key

#### redis.conf

```ini
# 设置最大内存
maxmemory 2gb
maxmemory-policy allkeys-lfu
```

> redis默认策略 noeviction，内存满直接报错，不淘汰。

常用命令

```shell
# redis-cli
redis-cli -h 47.115.61.169 -p 6380 -a xxxx
set verification:13112345678:code 060606 EX 300000
EXISTS key
TYPE key # 查看类型
```

```shell
# string
set key1 111

key "dong*"

# list操作
lpush list1 333
rpush list1 444
lpop 从左边删除
rpop 从右边删除
lrange list 0 -1

# set操作
sadd set1 111
sadd set1 111
sismember set1 111 判断是否是集合中的元素


# 排序需求
zadd zset1 5 xxx
zrange zset1 0 2 前三个

# hash
hset hash1 key1 1
hget hash1 key1

#geo

geoadd loc 13.361389 38.115556 "guangguang" 15.087269 37.502669 "dongdong"  ##实际使用zset
geodist loc guangguang dogndong # 计算距离
georadius loc 15 37 100 km # 搜索某半径的其他点

# time
expire dogn1 30 # 设置过气
ttl list1 # 查剩余过气时间
```

## 缓存穿透、缓存击穿、缓存雪崩

### 缓存穿透

描述：查询缓存、数据库没有的数据（故意），请求打到db

方案：

- 缓存空值（给不存在 key 存入 null，短 TTL）！！ 简单点
- **布隆过滤器**：前置拦截不存在 key（推荐）

### 布隆过滤器

> 特点：有极小误判率；**只能 add，不能删除元素**。作用：解决缓存穿透。判断【key 一定不存在 / 可能存在】
> 例子：布隆过滤器。Redis4.0 + 提供布隆过滤器插件 `redis‑bloom`；如果没有插件，业务代码可以手写布隆算法。

```ts
// 1.初始化布隆过滤器，预估元素10万，误判率0.01
await redis.bf.reserve("bloom:userid", 0.01, 100000);

// 2.把数据库全部有效userId预先加入布隆
await redis.bf.add("bloom:userid", 1001);
await redis.bf.add("bloom:userid", 1002);

// 3.查询接口，前置拦截
async function getUser(userId: number) {
  // 布隆判断：不存在直接返回，不访问缓存、数据库
  const exists = await redis.bf.exists("bloom:userid", userId);
  if (!exists) {
    return null; // 一定不存在，直接返回
  }
  // 布隆说可能存在，才走缓存→数据库
  let cache = await redis.get(`user:${userId}`);
  if (cache) return JSON.parse(cache);
  const dbUser = await db.user.findByPk(userId);
  await redis.set(`user:${userId}`, JSON.stringify(dbUser), "EX", 300);
  return dbUser;
}
```

### 缓存击穿

描述：热点key刚好过期，大量请求瞬间打到数据库
方案：

1. 互斥锁（Reids分布式锁，只放一个请求去查DB回写缓存）
2. 热点key永不过期，后台异步更新

### 缓存雪崩

**描述**：**大量 key 同时过期**，大量请求压垮数据库；Redis 宕机也会雪崩。
方案：

1. TTL 增加随机值，错开过期时间
2. 集群高可用（主从 + 哨兵）
3. 多级缓存（本地缓存 + Redis）
4. 限流、熔断降级

## 缓存更新策略

旁路缓存（Cache Aside，最常用）

- **读**：先查缓存，命中直接返回；未命中查 DB，写入缓存
- **写**：**更新数据库 → 删除缓存（不是更新缓存）**
  > 为什么删缓存而不是更新缓存：并发场景，更新缓存会出现脏数据；删除缓存，下次读自动加载最新数据。
  > 问题：短暂不一致；强一致性业务不能用。

## 持久化 RDB & AOF（高频）

### RDB 快照

把某时刻内存全部二进制dump到磁盘

触发：`bgsave`(fork子进程) 配置定时触发。

- ✅ 文件小，恢复速度快，适合冷备份；
- ❌ 两次快照之间宕机，丢失这段全部数据；fork 消耗内存。
  自动触发(配置规则)

```conf
# 900s内至少1次修改 → 生成rdb
save 900 1
save 300 10
save 60 10000 // 刚完成一次快照 50 秒后机器突然断电 这 50 秒新增所有数据全部丢失
```

手动触发
`SAVE`（阻塞主线程） / `BGSAVE`（fork 子进程后台执行）

### AOF

记录每一条**写命令**，append 到日志文件。

- ✅ 数据安全，可以配置每秒刷盘，最多丢 1 秒数据；支持 AOF 重写压缩日志；
- ❌ 文件体积大，重启恢复速度慢。
  Redis4.0 + 混合持久化：AOF 文件头部放 RDB 快照，后面追加增量 AOF 命令，兼顾恢复速度和安全性。
  > 重启加载优先级：**优先加载 AOF；没有 AOF 才加载 RDB**。

```ini
save 900 1          # RDB：900秒至少1次修改就bgsave
appendonly yes      # 开启AOF
appendfsync everysec# 默认每秒刷盘
```

#### AOF的三种刷盘策略

`appendfsync`

1. always:每条写都刷盘，最安全，性能最差
2. everysec（默认）：每秒刷1次，最多丢 1 秒数据，平衡推荐
3. no：交给操作系统自动刷，性能高，丢数据多

## 主从、哨兵、集群

### 主从复制原理？全量同步、增量同步

主节点写，从节点同步数据，读写分离。

1. **全量同步**：从库初次连接；主库 bgsave 生成 RDB，发给从库；同时缓冲区记录期间新命令；RDB 传输完成后，缓冲区命令继续同步。
2. **增量同步**：网络短暂断开；从库携带 offset、replid，主节点补发断开期间命令，不用全量 RDB。

### 示例

> 1 主 (6379)，2 从 (6380、6381)，同一台机器多实例。

1. 主节点 redis-6379.conf

```shell
port 6379
daemonize yes
pidfile /var/run/redis‑6379.pid
logfile "/var/log/redis‑6379.log"
dbfilename dump‑6379.rdb
dir /data/redis‑6379
appendonly yes
appendfilename "appendonly‑6379.aof"
# 主不需要配置replicaof
```

2.1 从节点 redis-6380.conf

```shell
port 6380
daemonize yes
pidfile /var/run/redis‑6380.pid
logfile "/var/log/redis‑6380.log"
dbfilename dump‑6380.rdb
dir /data/redis‑6380
appendonly yes
appendfilename "appendonly‑6380.aof"

# 指向主节点IP端口
replicaof 127.0.0.1 6379
# 从节点只读，默认开启
replica‑read‑only yes
```

启动命令

```shell
# 创建数据目录
mkdir -p /data/redis‑6379 /data/redis‑6380 /data/redis‑6381

redis‑server /etc/redis/redis‑6379.conf
redis‑server /etc/redis/redis‑6380.conf
redis‑server /etc/redis/redis‑6381.conf
```

验证主从

```shell
redis-cli -p 6739
127.0.0.1:6379> info replication # `connected_slaves:2`。
```

无自动故障转移

```shell
redis-cli -p 6380 # 登录这个从节点
replicaof no one # 取消它的从身份，提升为主
redis-cli -p 6381 # 剩下从节点
replicaof 127.0.0.1 6380 # 剩下其他从节点（例如 6381），指向新主
#旧主6379重启后执行
replicaof 127.0.0.1 6380  # 如果不做，双脑裂，两边独立写入，数据不一致
#在新主执行6380
info replication  # !!纯主从，代码连接也要变更
```

### Sentinel 哨兵作用？

> 哨兵不是 Redis 数据实例，是一套独立的进程，基于「主从复制」做高可用，解决主节点宕机之后自动故障转移。⚠️哨兵**不做数据分片**，所有节点保存完整全量数据；只是解决 “主挂了谁当新主” 的问题，不能用来扩容存储。
> 哨兵（Sentinel）：**监控主从、自动故障转移，保证高可用**，不做数据分片。

- 监控：检测 master/slave 是否存活
- 自动故障转移：master 宕机，投票选出新 master，修改其他从库指向新主.旧主恢复上线，哨兵强制把旧主变成从，挂载到新主，防止脑裂。
- 配置发现：给客户端提供真正主节点的IP和端口。客户端不写死主地址，只连哨兵集群。

架构例子

- 底层：1 个 Master + N 个 Slave（普通主从复制，数据同步）
- 上层：**奇数个哨兵进程（至少 3 个）**，哨兵互相之间也会通信投票。
  关键配置项 sentinel.conf

```ini
# 监控集群名字mymaster，主节点ip端口 ，quorum=2（3个哨兵至少有2个认为挂了，才执行故障转移）
sentinel monitor mymaster 127.0.0.1 2
# 5000ms收不到响应判断主观下线
sentinel down-after-milliseconds mymaster 5000
# 故障转移超时时间
sentinel failover-timeout mymaster 18000
```

客户端连接哨兵集群

```js
const redis = new Redis({
  sentinels: [
    { host: "192.168.1.10", port: 26379 },
    { host: "192.168.1.11", port: 26380 },
    { host: "192.168.1.12", port: 26381 },
  ],
  name:'mymaster'
});
```

|模式	|分片存储|	自动故障转移|	客户端是否需要改 IP|
|---|---|---|---|
|普通主从|	不分片|	无，需要人工操作|	主切换后必须改配置重启|
|Sentinel 哨兵|	不分片，全量数据|	✅自动故障转移|	❌不用改，自动发现新主|
|Redis‑Cluster 集群|	✅哈希槽分片，支持扩容|	✅自带主从故障转移|	❌不用改，自动刷新拓扑|

### Redis Cluster 集群原理
> redis自带的分片集群方案，具备**数据分片 + 主从高可用**
> 一句话：把数据拆分到多台 master 上存储（解决容量水平扩容），每个 master 挂载 slave 做备份；master 宕机，集群自动把它的 slave 提升成新主。
Redis Cluster（分片集群）：**既分片扩容，又自带主从故障转移**
> ✅最小生产规格：**3 主 3 从**（3 个 master，每个 master 带 1 个 slave，共 6 个 redis-server 实例）
举 3 主例子：
- Master‑1：负责槽 0‑5460 → 只存落在 0~5460 的 key
- Master‑2：负责槽 5461‑10922 → 只存落在 5461‑10922 的 key
- Master‑3：负责槽 10923‑16383 → 只存落在 10923‑16383 的 key

- 一共 **16384 个哈希槽 (0~16383)**
- `CRC16(key) % 16384` 算出 key 对应的槽，槽分配到不同 master 节点
- 每个 master 挂若干 slave；master 宕机，slave 升主
- 客户端直连集群节点，MOVED 重定向；要求至少**3 主 3 从**最小集群。
  > 哨兵：高可用，不分片；Cluster：分片 + 高可用。

## redis分布式锁怎么实现？会有什么问题？

> 当服务部署多实例，多个进程会并发操作同一个共享资源，要求同一时间只有一个线程执行业务逻辑，此时使用分布式锁。

### 场景

- 库存扣减（秒杀）
- 缓存击穿互斥重建热点缓存
- 定时任务重复执行
- 第三方接口幂等、外部资源抢占

正确命令（原子）

> 判断不存在 + 设置值 + 设置过期时间，一条命令完成，不会出现死锁,释放不能del，要用Lua脚本原子化

```redis
SET lock_key uuid NX EX 30
```

```lua
if redis.call('GET',KEYS[1] === ARGV[1]) then
    return redis.call('DEL',KEYS[1])
else
    return 0
end
```

代码示例，分布式锁使用

```
redis.eval( lua脚本文本, key的数量, KEYS[1], KEYS[2]..., ARGV[1], ARGV[2]... )
```

```js
// 伪代码 Nest/Node
async function getHotData() {
  // 1.先查缓存
  let data = await redis.get("hot_goods_1001");
  if (data) return JSON.parse(data);

  // 2.缓存未命中，抢互斥锁
  const lockKey = "lock:hot_goods_1001";
  // SET key value NX EX 原子加锁
  const lockOk = await redis.set(lockKey, uuid(), "NX", "EX", 5);

  if (lockOk) {
    try {
      // 获取锁，去查数据库
      const dbData = await db.goods.findByPk(1001);
      await redis.set("hot_goods_1001", JSON.stringify(dbData), "EX", 60);
      return dbData;
    } finally {
      // Lua脚本释放锁，保证：是自己的锁才删除，原子操作
      const lua = `
        if redis.call('get',KEYS[1]) == ARGV[1] then
          return redis.call('del',KEYS[1])
        else
          return 0
        end
      `;
      await redis.eval(lua, 1, lockKey, uuid());
    }
  } else {
    // 没拿到锁，短暂休眠后重试
    await sleep(100);
    return getHotData();
  }
}
```

### 问题

- **主从异步复制缺陷**：master 刚加锁，还没同步给 slave 就宕机，slave 升主，其他客户端又拿到锁 → **锁失效**。
  > 解决方案：Redlock（多独立实例加锁，生产慎用，复杂）；业务上允许少量不一致，或者用 Zookeeper 锁。
- 业务执行超过锁过期时间，锁被自动释放，其他线程拿到锁 → 锁失效。
  > 解决：锁续期（看门狗 watchdog，Redisson 自动实现）
  > 生产优先直接用 **Redisson**，自带看门狗续期，不用手写 Lua。

## Redis 事务、Lua脚本

> 批量串行，中间不会插入其它客户端命令，并非回滚。

### Redis 事务：MULTI、EXEC、DISCARD、WATCH

```redis
WATCH balance  #监听 如果multi～exec之间有其他客户端改了balance，则整个事务队列全部放弃执行。
GET balance
MULTI
DECRBY balance 10
INCRBY other 10
EXEC
```

> 现实开发：分布式锁、条件修改，**优先用 Lua 脚本，少用 MULTI+WATCH**。

### Lua

Lua 脚本：服务端原子执行，适合复杂原子操作，分布式锁释放、限流常用。

## Pub/Sub和Stream的区别

### Stream

> Redis Stream 是 Redis 5.0+ 新增的数据结构，**专门设计做消息流 / 消息队列**，类似 Kafka。
> 特点：消息持久化、消息 ID 有序、支持消费者组、消息 ack、多消费、回溯读取。
> 层：是一个大的 List，每条消息带唯一 ID，消息不会自动删除（除非设置 maxlen 裁剪）。
> 概念：

1. stream Key：整个消息的key，如`order.stream`
2. 消息ID，默认`毫秒时间戳+序列号`
3. 消息内容 field-value键值对，如同hash
4. Consumer Group（核心）
   - 多个消费者归到同一个组；**一条消息只会发给组内其中一个消费者（负载均衡）**
   - 不同消费者组互相独立，同一条消息可以被多个组全部消费（广播）
5. Pending List
   - 消息投递给消费者后，进入 pending；**必须 XACK 确认**，否则消息不会被标记完成
   - 消费者宕机未 ack，消息留在 PEL，可以用`XPENDING`、`XCLAIM`转移消息给其他消费者（死消息转移）
6. maxlen：
   - 限制stream最大消息条数，自动淘汰旧消息
     基础命令

```shell
XADD order:stream * orderId 100 status paid

XADD order:stream MAXLEN ~ 1000 * orderId 100 status paid

# 0=永久阻塞
XREAD COUNT 2 BLOCK 0 STREAMS order:stream >
# `>` 从新增消息开始读，已存在的旧消息不读
#BLOCK ms：阻塞等待，0 无限等；适合轮询
# 也可以指定消息 ID，从某个历史位置回溯消费
# 指定消息 ID，从某个历史位置回溯消费
XREAD order:stream 1752000000000-0 (没有ack、没有pending、宕机丢失)
```

消费者组相关

```shell
# 创建 g1 从stream最新消息开始消费
XGROUP CREATE order:stream g1 $ MKSTREAM
```

- `$`: 创建的组只消费之后新增的消息，历史消息不读
- `0`: 从 stream**第一条历史消息**从头消费
- `MKSTREAM`:stream 不存在时自动创建 stream（可选）

```shell
# 组g1，消费者c1，读取新消息，阻塞，最多1条
XREADGROUP GROUP g1 c1 COUNT 1 BLOCK 0 STREAMS order:stream >
```

- `>`：读取**从未投递过的新消息**
  XACK: 确认消费

```shell
XACK order:stream g1 1752000000000-0
```

XPENDING

```shell
# 查询pending
XPENDING order:stream g1
```

XCLAIM转移消息：消费者 c1 卡死，长时间不 ack；把这条消息转移给 c2 继续处理：

```shell
XCLAIM order:stream g1 c2 30000 1752000000000-0
```

`30000` 至少空闲30s才可以转移
其他

```shell
# 查询stream信息，消息总数、最后一条id
XINFO STREAM order:stream

# 查询消费者组信息
XINFO GROUPS order:stream

# 查询组内消费者
XINFO CONSUMERS order:stream g1

# 删除单条消息（很少主动删，一般靠maxlen裁剪）
XDEL order:stream 1752000000000-0
```

- Pub/Sub：发布订阅，消息无持久化，**下线消息直接丢**，没有 ACK；适合简单通知。
- Stream：Redis5+，持久化、消息 ID、消费者组、ACK、消息回溯；适合可靠消息队列。

### 附

- Redis 是单线程，怎么利用多核？**部署多个 Redis 实例，绑定不同 CPU 核心**。
- KEYS 命令为什么禁止线上使用？全库扫描，阻塞主线程；替代 SCAN。
- Redis 能不能做消息队列？可以，List、PubSub、Stream；但不适合严格事务、死信复杂场景，优先 RabbitMQ。
