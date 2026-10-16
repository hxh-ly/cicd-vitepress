---
outline: [2, 3]
---

# SQL 索引

本文整理索引结构、设计原则、执行计划和索引相关的调优问题。事务、MVCC、日志与慢查询整体流程见 [SQL](./sql.md)，锁机制见 [SQL 锁机制](./sql-lock.md)。

## 索引基础

### 聚簇索引

> 主键就是聚簇索引；表的全部行数据，直接存在主键B+树的叶子节点。
> 二级索引：叶子节点不存整行，只存主键值；查到主键后再去主键B+树找行数据，这个动作叫回表
> 没有定义主键：InnoDB自动选唯一非空索引当聚簇索引；都没有，自动生成隐藏rowid作主键
```sql
CREATE TABLE `user` {
    id BIGNIT PRIMARY KEY, --- 聚簇索引
    name VARCHAR(32),
    age INT,
    phone VARCHAR(11),
    INDEX idx_name(name) -- 二级索引
}
```
1. `select * from user where id = 10` 直接走聚簇索引，拿到完整行，无回表
2. `select * from user where name='zhangsan'`:索引拿到id聚簇索引读取行数据 -> 回表

### 覆盖索引与回表

索引：id(a,b,c)

```sql
---覆盖索引，不回表----
select a,b from, t where a=1

------❌，会回表----------
select * from t where a = 1
```

### B + 树索引特点，为什么不用 B 树、哈希索引

- B + 树：全部数据在叶子节点；叶子双向链表；非叶子只存 key，适合范围查询、排序、分页。
- B 树：每个节点存完整数据，范围查询差。
- hash 索引：等值快，**不支持范围、排序、前缀模糊**；InnoDB 自适应 hash 是内存辅助结构。

## 索引设计与使用

### 联合索引最左匹配原则

联合索引 `(a,b,c)`

- 生效条件：查询条件**从最左列开始连续使用**
- 可以：`where a=?` / `where a=? and b=?` / `where a=? and b=? and c=?`
- 失效：`where b=?`、`where b=? and c=?`；跳过 a 直接用后面字段，索引失效。
> 范围条件之后的列索引失效。`where a=1 and b>2 and c=3` → c 不走索引。

### 索引失效场景（高频）

1. 对索引列做函数运算、隐式类型转换（字符串不加引号）
2. `like '%xxx'` 前缀通配符
3. or 条件有一列没有索引
4. 违反最左前缀
5. mysql 优化器判断全表扫描更快，放弃索引（数据量小、区分度低）

### 什么情况不要建索引

1. 数据量小表；
2. 低区分度字段（性别、状态只有 2‑3 个值）；
3. 频繁更新字段，索引维护成本高；
4. 很少用于 where/group by/order by 的字段。

### 排序索引 （利用索引做 order by，避免 Using filesort）

> 句话：**索引本身是有序的 B + 树，当`ORDER BY`的字段顺序和索引定义顺序一致时，MySQL 可以直接顺着索引有序读取数据，不用额外内存 / 磁盘排序，这就是走索引排序，俗称排序索引**。
> 重点：`Using filesort` 就是**没用到索引排序，数据库自己做排序**，是慢查询常见元凶。

- 排序索引本质：**B + 树索引叶子节点本身有序，直接读取有序数据，跳过排序阶段**
- 核心约束：最左前缀、等值在前范围在后、order by 字段顺序与索引一致，升降序统一
- 调优目标：消灭大查询里的 `Using filesort`

#### 例子

```sql
KEY idx_status_created (status, created_at, id)
```
可利用排序索引
```sql
-- 1. 等值status，order by 后面按索引顺序
SELECT id,created_at FROM users
WHERE status=1
ORDER BY created_at;

-- 2. 等值status，order by created_at, id
SELECT id,created_at FROM users
WHERE status=1
ORDER BY created_at,id;
```
- where 对`status`做等值匹配，剩下排序字段刚好是索引后面的列；
- 数据从索引拿出来天然有序 → **没有 Using filesort**

❌不能走索引排序，触发 filesort
```sql
-- 跳过status，直接order by created_at
SELECT id FROM users
ORDER BY created_at;

-- 排序方向颠倒
SELECT id FROM users
WHERE status=1
ORDER BY id, created_at;

-- 同一 order by 里不能混合升降序，否则索引排序失效
WHERE status=1 ORDER BY created_at DESC, id ASC;
```
索引：`(a, b, c)`
> 口诀：**等值在前，范围在后；范围之后，索引失效（不能排序）**
```sql
---- c在范围之后，失去排序索引作用
where a=1 and b>10 order by c; 
```

## EXPLAIN 执行计划

### 使用方式

> mysql的分析命令，在不真正执行sql的前提下，告诉mysql打算怎么执行这条sql
```sql
EXPLAIN select * from user where id=100;
```
执行后返回一张表格，每一列代表数据库的执行策略。作用：排查慢查询，看有没有走索引、扫描多少行、表连接顺序、是否排序，是否用临时表

### 核心字段详解

1.`id`：查询序号，有多表 join、子查询时出现。
- id相同：表是同一组，执行顺序从上到下
- id越大越先执行：子查询优先执行
2.`select_type`查询类型
- SIMPLE：简单查询、没有join、没有子查询
- PRIMIARY：最外层查询
- SUBQUERY：子查询
- DERIVED：衍生表（from里面套子查询、生成临时表）
1. `table`
当前操作的哪张表，可以是真实表、临时表
1. `type`【最重要，访问类型，性能从好到差排序】
> 日常优先看type，尽量往左边靠拢
`system` > `const` > `eq_ref` > `ref` > `range` > `index` > `ALL`

|type|	含义|
|---|---|
|const	|常量匹配，主键 / 唯一索引等值查询，最多返回 1 行，速度极快|
|eq_ref|	join 场景，主键 / 唯一索引关联，一对一匹配|
|ref|	普通索引等值查询，命中多条|
|range|	范围查询：> < between in，用到索引范围扫描|
|index|	索引全扫描，扫描整个索引树，比全表扫描好，但依然慢|
|ALL	|全表扫描！大表出现 ALL 就是危险信号，没用到索引|

5.possible_keys
理论上**可以使用**的索引，只是候选，不一定真正用上。

6.key
**实际真正使用到的索引**。

7.key_len
索引使用的字节长度，可以判断联合索引使用了几个字段。

8.ref
索引匹配使用的是常量还是哪个表的列。

9.row【预估扫描行数】
MySQL 估算**需要扫描多少行**，不是返回行数。
> 这个数值越大，开销越高。left join、笛卡尔积问题，这里会看到巨大数字。
> ⚠️只是预估，统计信息不准的时候会偏差很大。

10.Extra【额外信息，大量坑在这里】
重点高频值：

 1. **Using Where**:存储引擎返回数据之后，MySQL 服务层再做条件过滤。不代表没索引。
 2. **Using index**：✅**覆盖索引！很好**，只读取索引，不需要回表拿原始数据，性能很高。
 3. **Using filesort**：❌**文件排序，坏信号**。没有利用索引排序，MySQL 内存 / 磁盘做排序，数据量大非常慢。对应 order by 没走索引。
 4. **Using temporary**：❌**使用临时表，坏信号**。group by /distinct 没有索引，创建临时表，大表性能灾难。
 5. `Using join buffer`:join 没有用上索引，使用连接缓冲。大概率慢查询。

### 关键字段速览

重点列：

- `type`：访问级别，性能从好到坏：`system > const > eq_ref > ref > range > index > ALL`，尽量到 range/ref，避免 ALL 全表扫描
- `key`：实际使用的索引
- `rows`：预估扫描行数
- `Extra`：
  - `Using index`：**覆盖索引**
  - `Using filesort`：文件排序，没有用到索引排序，需要优化
  - `Using temporary`：使用临时表，常见 group by 无索引
> 手写：`explain select …`

## 索引与慢查询

1.缺少索引：where、join、order by 字段没建索引，全表扫描，扫描大量行。
```sql
-- name没有索引，全表扫描
select * from user where name='张三';
```
2.**索引失效**：索引列做函数运算、隐式类型转换、like `%xxx` 前缀通配符，不走索引。
```sql
-- 索引失效
select * from user where substr(phone,1,3)='138';
```

完整的慢查询定位与优化流程见 [SQL 调优、慢查询](./sql.md#sql-调优、慢查询)。

## 索引相关面试问答

### Q1：limit 100000,10 为什么慢？怎么优化？

> 
> offset 10 万，mysql 需要扫描并丢弃前 10 万行，再拿 10 条。
> 优化：主键分页：

```
select * from t where id > 100000 limit 10;
```

### Q2：索引还在，为什么 EXPLAIN 变成 ALL 全表扫描？

- 统计信息不准，analyze table 更新统计；
- 优化器评估认为索引开销更大放弃索引；
- 区分度变化；参数调整。
