# 分布式事务 
## 是什么
一次业务操作，跨多个微服务，多个数据库，要保证要么全部成功，要么全部回滚。
> 服务A调用DB1，服务B调用DB2，这两个操作属于同一个业务，如果A成功，B失败 -> 数据不一致，这就是分布式事务要解决的问题

常见方案：
1.2PC（两阶段）提交：强一致性，性能差，不适合高并发微服务
2.TCC（try-confirm-canel）：业务侵入型高，性能较好，强一致
3.SAGA：长事务，最常用，分两种：
    - 编排式（orchestraion）：中央协调器（推荐，nest微服务常用）
    - 编排式（Choreography）：事件驱动，服务之间互相监听
4.本地消息表/可靠消息队列（最终一致性，业务最常用）：异步，最终一致，适合大多数业务
> 生产微服务最常用：SAGA模式 或者 可靠消息队列 （RocketMQ/rabbitMQ）

## SAGA
业务流程：

1. 下单：创建订单，状态 `pending`
2. 扣减库存（调用库存微服务）
3. 如果库存扣减成功 → 更新订单为 `success`
4. 如果库存扣减失败 / 超时 → 订单回滚，恢复库存
```
1. 用户下单请求 → 协调器生成 saga_tx_001，写入saga_record RUNNING
2. Step1：订单服务：创建订单，status=PROCESSING ✅
3. Step2：账户服务：扣款 → 返回失败 ❌
4. 触发补偿：执行Step1的反向补偿：订单标记为FAIL，saga_record更新 COMPENSATED
→ saga_tx_001 这条Saga结束，不再使用

用户再次点下单：
1. 协调器生成 saga_tx_002（全新id），新Saga链
2. 重新走：创建订单 → 扣款 → 扣库存
```
1.saga_record表 DDL
```sql
CREATE TABLE `saga_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `saga_tx_id` varchar(64) NOT NULL COMMENT '全局Saga事务ID',
  `status` varchar(20) NOT NULL COMMENT 'RUNNING / SUCCESS / COMPENSATED / FAILED',
  `current_step` int NOT NULL DEFAULT 0 COMMENT '当前执行到第几步',
  `steps_json` longtext NOT NULL COMMENT '所有步骤信息，正向+补偿',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_saga_tx_id` (`saga_tx_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='协调式Saga全局事务记录表';
```
枚举
```ts
// src/saga/saga-status.enum.ts
export enum SagaStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED', // 正向执行失败，补偿还未完成
  COMPENSATED = 'COMPENSATED', // 补偿全部完成
}
```
SagaRecord Entity
```ts
// src/saga/entities/saga-record.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SagaStatus } from '../saga-status.enum';

/**
 * Saga单步定义
 */
export interface SagaStep {
  stepName: string;
  // 正向执行函数标识
  action: string;
  // 补偿函数标识
  compensate: string;
  // 步骤状态：PENDING / DONE / COMPENSATED
  state: 'PENDING' | 'DONE' | 'COMPENSATED';
}

@Entity('saga_record')
export class SagaRecord {
  @PrimaryGeneratedColumn('bigint')
  id: number;

  @Column({ length: 64, unique: true })
  sagaTxId: string;

  @Column({ length: 20 })
  status: SagaStatus;

  @Column({ type: 'int', default: 0 })
  currentStep: number;

  // 存储SagaStep数组json字符串
  @Column({ type: 'longtext' })
  stepsJson: string;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;

  // 读取json
  get steps(): SagaStep[] {
    return JSON.parse(this.stepsJson);
  }
  set steps(val: SagaStep[]) {
    this.stepsJson = JSON.stringify(val);
  }
}
```
2. Saga 公共服务（协调器底层能力）
```ts
// src/saga/saga.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SagaRecord, SagaStep } from './entities/saga-record.entity';
import { SagaStatus } from './saga-status.enum';

@Injectable()
export class SagaService {
  constructor(
    @InjectRepository(SagaRecord)
    private readonly sagaRepo: Repository<SagaRecord>,
  ) {}

  // 创建Saga事务记录，定义整个流程步骤
  async createSagaRecord(steps: SagaStep[]): Promise<string> {
    const sagaTxId = uuidv4();
    const record = new SagaRecord();
    record.sagaTxId = sagaTxId;
    record.status = SagaStatus.RUNNING;
    record.currentStep = 0;
    record.steps = steps;
    await this.sagaRepo.save(record);
    return sagaTxId;
  }

  async getByTxId(sagaTxId: string): Promise<SagaRecord> {
    return this.sagaRepo.findOneBy({ sagaTxId });
  }

  async updateRecord(record: SagaRecord) {
    await this.sagaRepo.save(record);
  }

  // 补偿任务：宕机恢复时扫描RUNNING的saga，继续执行补偿
  async scanPendingSaga() {
    const list = await this.sagaRepo.findBy({ status: SagaStatus.RUNNING });
    for (const item of list) {
      console.log('【Saga补偿定时任务】恢复事务：', item.sagaTxId);
      // 交给业务层恢复执行
    }
    return list;
  }
}
```
SagaModule
```ts
// src/saga/saga.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SagaRecord } from './entities/saga-record.entity';
import { SagaService } from './saga.service';

@Module({
  imports: [TypeOrmModule.forFeature([SagaRecord])],
  providers: [SagaService],
  exports: [SagaService],
})
export class SagaModule {}
```
3. 订单实体
```ts
// src/order/entities/order.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('bigint')
  id: number;

  @Column({ length: 64, comment: 'saga事务id' })
  sagaTxId: string;

  @Column()
  goodsId: number;

  @Column()
  num: number;

  // PROCESSING / SUCCESS / FAIL
  @Column({ length: 20 })
  status: string;

  @CreateDateColumn()
  createTime: Date;
}
```
```sql
CREATE TABLE `orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `saga_tx_id` varchar(64) NOT NULL,
  `goods_id` int NOT NULL,
  `num` int NOT NULL,
  `status` varchar(20) NOT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
4. 账户微服务（参与者）
```ts
// src/account/account.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AccountService {
  /** 正向：扣款 */
  async deductBalance(sagaTxId: string, userId: number, amount: number) {
    console.log(`【账户正向扣款】sagaTxId=${sagaTxId}, userId:${userId}, amount:${amount}`);
    // update account set balance = balance - amount where id = userId
    // 幂等：基于sagaTxId，防止重复扣款
    return true;
  }

  /** 补偿：退款 */
  async refundBalance(sagaTxId: string, userId: number, amount: number) {
    console.log(`【账户补偿退款】sagaTxId=${sagaTxId}, userId:${userId}, amount:${amount}`);
    // update account set balance = balance + amount where id = userId
    return true;
  }
}
```
5. 库存微服务（参与者）
```ts
// src/stock/stock.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class StockService {
  /** 正向：扣库存 */
  async deductStock(sagaTxId: string, goodsId: number, num: number) {
    console.log(`【库存正向扣减】sagaTxId=${sagaTxId}, goodsId:${goodsId}, num:${num}`);
    // update stock set stock = stock - num where goodsId = goodsId
    return true;
  }

  /** 补偿：恢复库存 */
  async revertStock(sagaTxId: string, goodsId: number, num: number) {
    console.log(`【库存补偿恢复】sagaTxId=${sagaTxId}, goodsId:${goodsId}, num:${num}`);
    // update stock set stock = stock + num where goodsId = goodsId
    return true;
  }
}
```
6.订单编排
```ts
// src/order/order.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SagaService } from '../saga/saga.service';
import { SagaStatus } from '../saga/saga-status.enum';
import { Order } from './entities/order.entity';
import { AccountService } from '../account/account.service';
import { StockService } from '../stock/stock.service';
import { SagaStep } from '../saga/entities/saga-record.entity';

@Injectable()
export class OrderService {
  constructor(
    private readonly sagaService: SagaService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly accountService: AccountService,
    private readonly stockService: StockService,
  ) {}

  async createOrder(userId: number, goodsId: number, num: number, amount: number) {
    // 1. 定义Saga正向步骤 + 对应的补偿步骤
    const steps: SagaStep[] = [
      {
        stepName: '创建订单',
        action: 'createOrderAction',
        compensate: 'cancelOrderCompensate',
        state: 'PENDING',
      },
      {
        stepName: '账户扣款',
        action: 'deductBalanceAction',
        compensate: 'refundBalanceCompensate',
        state: 'PENDING',
      },
      {
        stepName: '扣减库存',
        action: 'deductStockAction',
        compensate: 'revertStockCompensate',
        state: 'PENDING',
      },
    ];

    // 新建Saga全局记录
    const sagaTxId = await this.sagaService.createSagaRecord(steps);
    console.log('Saga事务ID：', sagaTxId);

    const sagaRecord = await this.sagaService.getByTxId(sagaTxId);
    const params = { userId, goodsId, num, amount };

    try {
      // ========== 正向执行Saga ==========
      for (let i = 0; i < sagaRecord.steps.length; i++) {
        sagaRecord.currentStep = i;
        const step = sagaRecord.steps[i];
        if (step.state === 'DONE') continue;

        console.log(`执行步骤[${i}]：${step.stepName}`);
        switch (step.action) {
          case 'createOrderAction':
            await this.createOrderAction(sagaTxId, goodsId, num);
            break;
          case 'deductBalanceAction':
            await this.accountService.deductBalance(sagaTxId, userId, amount);
            // 可以在这里抛异常模拟失败：throw new Error('扣款失败！');
            break;
          case 'deductStockAction':
            await this.stockService.deductStock(sagaTxId, goodsId, num);
            break;
        }
        // 标记当前步骤完成
        step.state = 'DONE';
        await this.sagaService.updateRecord(sagaRecord);
      }

      // 全部正向执行成功
      sagaRecord.status = SagaStatus.SUCCESS;
      await this.sagaService.updateRecord(sagaRecord);
      console.log('Saga全部执行成功');
      return { success: true, sagaTxId };

    } catch (err) {
      console.error('Saga正向流程失败，开始执行补偿', err);
      // ========== 补偿逻辑：反向遍历已经执行成功的步骤，执行补偿 ==========
      sagaRecord.status = SagaStatus.FAILED;
      await this.sagaService.updateRecord(sagaRecord);

      // 从当前失败步骤的前一步，反向遍历
      for (let i = sagaRecord.currentStep; i >= 0; i--) {
        const step = sagaRecord.steps[i];
        if (step.state !== 'DONE') continue;
        console.log(`补偿步骤[${i}]：${step.stepName}`);
        switch (step.compensate) {
          case 'cancelOrderCompensate':
            await this.cancelOrderCompensate(sagaTxId);
            break;
          case 'refundBalanceCompensate':
            await this.accountService.refundBalance(sagaTxId, userId, amount);
            break;
          case 'revertStockCompensate':
            await this.stockService.revertStock(sagaTxId, goodsId, num);
            break;
        }
        step.state = 'COMPENSATED';
        await this.sagaService.updateRecord(sagaRecord);
      }
      // 全部补偿完成
      sagaRecord.status = SagaStatus.COMPENSATED;
      await this.sagaService.updateRecord(sagaRecord);
      return { success: false, sagaTxId, msg: '流程失败，补偿已执行' };
    }
  }

  // 【正向步骤】创建订单
  async createOrderAction(sagaTxId: string, goodsId: number, num: number) {
    const order = new Order();
    order.sagaTxId = sagaTxId;
    order.goodsId = goodsId;
    order.num = num;
    order.status = 'PROCESSING';
    await this.orderRepo.save(order);
  }

  // 【补偿步骤】取消订单
  async cancelOrderCompensate(sagaTxId: string) {
    await this.orderRepo.update({ sagaTxId }, { status: 'FAIL' });
  }
}
```

### 重点说明（坑点）

1. **SAGA 本质是补偿事务**
没有全局锁，**最终一致性**。如果补偿接口本身也挂了，需要**定时任务重试补偿**，必须做幂等！

> 1 **补偿必须幂等**：所有补偿接口，都要基于`sagaTxId`做幂等判断。定时恢复任务会重试补偿，不能重复退款 / 恢复库存。

> 2 中间状态可见，创建订单成功，扣款还没完成，订单状态 PROCESSING，用户前端可以查到。Saga 天然这个问题，无法避免。

> 3 协调器宕机：`saga_record`持久化，重启后定时任务扫描 RUNNING 状态事务，继续执行补偿。

> 4 补偿失败怎么办？ 生产上：补偿重试 + 告警人工介入。Saga 没有自动兜底，**补偿最终必须人工保障**。

2. 幂等实现思路
用 `orderId` 作为幂等 key，库存表记录操作流水，同一个 orderId 只能执行一次扣减 / 回滚。
3. 生产级方案
   - 简单场景：**可靠消息队列（RabbitMQ/RocketMQ 事务消息）**，本地消息表
   - 长流程复杂业务：**SAGA 编排引擎**（如 `nestjs-saga`、Axon Server、Seata SAGA）
   - 如果你想用 **Seata**（阿里分布式事务框架），NestJS + Seata 也可以集成，Seata 支持 AT、TCC、SAGA

## Seata AT 模式（最常用，对业务代码侵入最小）

>  AT = Automatic Transaction，**无侵入式分布式事务**，Seata 最主流模式。 只能作用于关系型数据库 MySQL，Mongo/Redis 不支持 AT
> 核心思想：**一阶段执行业务 SQL + 自动生成 undo_log 回滚日志并提交本地事务；二阶段提交 / 回滚**
> 前提：**数据库必须支持本地事务（MySQL InnoDB）**

> NestJS + TypeORM 可以接入 Seata-node，适合不想写大量补偿代码的场景。

### 三阶段简述（Seata AT）
1. **一阶段**
执行业务 SQL → Seata 代理 JDBC，自动记录`undo_log`（数据镜像：修改前 + 修改后），**在同一个本地事务里：业务 SQL + 插入 undo_log 一起提交**。释放本地锁，提交事务。向 TC (事务协调器) 注册分支事务。
2. **二阶段 - 提交**：TC 通知分支提交，**异步删除 undo_log，快速完成**
3. **二阶段 - 回滚**：TC 通知分支回滚，**读取 undo_log，生成补偿 SQL 回滚数据，然后删除 undo_log**

关键角色：
- TC：Transaction Coordinator，独立服务，全局事务协调中心（单独部署）
- TM：Transaction Manager，业务应用，开启 / 提交 / 回滚全局事务
- RM：Resource Manager，微服务资源管理器，和 TC 交互，管理 undo_log

### 列子AT（seata node）
undo_log 表(每个参与 AT 的微服务库都要建这张表)
```sql
CREATE TABLE `undo_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `branch_id` bigint(20) NOT NULL,
  `xid` varchar(100) NOT NULL,
  `context` varchar(128) NOT NULL,
  `rollback_info` longblob NOT NULL,
  `log_status` int(11) NOT NULL,
  `log_created` datetime NOT NULL,
  `log_modified` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_undo_log` (`xid`,`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Seata AT undo日志表';
```
单独部署tc服务
```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeataModule } from 'seata-nodejs/nest';
import { OrderModule } from './order/order.module';
import { StockModule } from './stock/stock.module';

@Module({
  imports: [
    // Seata 客户端配置，连接TC
    SeataModule.forRoot({
      service: {
        vgroupMapping: {
          'my_tx_group': 'default'
        },
      },
      transport: {
        type: 'tcp',
        server: '127.0.0.1:8091' // seata TC地址
      },
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'xxx',
      database: 'order_db',
      autoLoadEntities: true,
      synchronize: false,
    }),
    OrderModule,
    StockModule
  ],
})
export class AppModule {}
```

```ts
// order.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalTransactional } from 'seata-nodejs/nest';
import { Order } from './entities/order.entity';
import { StockService } from '../stock/stock.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly stockService: StockService,
  ) {}

  // ✅ 注解开启全局事务，TM自动生成全局xid
  @GlobalTransactional()
  async createOrder(goodsId: number, num: number) {
    // 1. 创建订单，【一阶段：自动生成undo_log】
    const order = new Order();
    order.goodsId = goodsId;
    order.num = num;
    order.status = 'SUCCESS';
    await this.orderRepo.save(order);

    // 2. 远程调用库存服务，RM自动注册分支事务
    await this.stockService.deductStock(goodsId, num);

    // 任意抛出异常，Seata自动触发二阶段回滚，自动利用undo_log恢复数据
    // throw new Error('扣款失败，触发全局回滚');
    return { success: true };
  }
}
```
```ts
// stock.service.ts 库存微服务
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stock } from './entities/stock.entity';

@Injectable()
export class StockService {
  constructor(@InjectRepository(Stock) private stockRepo: Repository<Stock>) {}

  async deductStock(goodsId: number, num: number) {
    // RM自动捕获SQL，生成undo log，注册分支
    await this.stockRepo.decrement({ id: goodsId }, 'stockCount', num);
  }
}
```

### AT优缺点
**优点**

1. **业务几乎无侵入**，不用写 Try/Confirm/Cancel，不用手写补偿 SQL，开发成本最低
2. 一阶段提交本地事务，性能优于 TCC（TCC 多轮 RPC）
3. 成熟稳定，Java 生态 SpringBoot Seata AT 是国内生产最常用方案

❌ **缺点**

1. **只能 MySQL (InnoDB)，强依赖数据库本地事务**，Mongo、Redis 不支持 AT
2. 一阶段会**持有行锁直到本地事务提交**，有**锁竞争、长事务风险**；大事务会导致数据库压力大
3. undo_log 会有存储开销；回滚是基于镜像补偿，**非幂等场景需要自己处理**
4. 存在**脏读**：一阶段提交后，其他事务可以读到未提交全局事务的数据（隔离级别问题）
5. Node.js 的`seata-nodejs`生态**远弱于 SpringBoot**，社区维护弱，生产踩坑多

### AT 适用范围

✅ 适合：**微服务，MySQL，业务不想写复杂补偿逻辑，短事务，并发不是极高的业务**（电商下单、订单支付）

❌ 不适合：非关系型数据库、长事务、高并发秒杀、跨数据库类型、需要强隔离场景

## 本地消息表极简思路（最终一致性，异步）

1. 下单服务：本地事务，保存订单 + 写入【消息表】（待发送消息）
2. 定时任务轮询消息表，发送消息到 MQ
3. 库存服务消费 MQ，扣减库存；消费成功 ACK，失败重试
4. 库存服务处理失败，发送失败消息，订单服务消费后更新订单失败

优点：简单、高可用；缺点：异步，不能实时返回结果。

## TCC（try-confirm-cancel）

### 例子
> T 资源检查，预留资源（冻结库存，冻结余额，不提交最终业务）
> C 确认执行预留业务，释放冻结资源（真正扣库存、扣余额）
> C 取消，回滚预留资源（解冻库存、解冻余额
业务场景：下单，2 个微服务

- `order-service` 订单服务（TCC 协调器）
- `stock-service` 库存服务（TCC 参与者）

数据库：MySQL，ORM：TypeORM，新增 `tcc_record` 事务状态表，用来记录全局事务状态，解决协调器宕机、幂等、悬挂问题。

1.tcc_record
```ts
CREATE TABLE `tcc_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tx_id` varchar(64) NOT NULL COMMENT '全局事务ID，唯一',
  `status` tinyint NOT NULL COMMENT '事务状态：1=TRYING 2=CONFIRMED 3=CANCELLED 4=TRY_FAILED',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tx_id` (`tx_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='TCC全局事务记录';
```
状态枚举
```ts
// src/tcc/tcc-status.enum.ts
export enum TccTxStatus {
  TRYING = 1,
  CONFIRMED = 2,
  CANCELLED = 3,
  TRY_FAILED = 4,
}
```
TccRecord Entity（TypeORM）
```ts
// src/tcc/entities/tcc-record.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TccTxStatus } from '../tcc-status.enum';

@Entity('tcc_record')
export class TccRecord {
  @PrimaryGeneratedColumn('bigint')
  id: number;

  @Column({ length: 64, unique: true })
  txId: string;

  @Column({ type: 'tinyint' })
  status: TccTxStatus;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;
}
```
2.公共tcc工具：生成全局事务 ID + 事务记录 Repository
```ts
// src/tcc/tcc.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TccRecord } from './entities/tcc-record.entity';
import { TccTxStatus } from './tcc-status.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TccService {
  constructor(
    @InjectRepository(TccRecord)
    private readonly tccRecordRepo: Repository<TccRecord>,
  ) {}

  // 创建全局事务记录，状态TRYING
  async createTxRecord(): Promise<string> {
    const txId = uuidv4();
    await this.tccRecordRepo.save({
      txId,
      status: TccTxStatus.TRYING,
    });
    return txId;
  }

  async updateStatus(txId: string, status: TccTxStatus) {
    await this.tccRecordRepo.update({ txId }, { status });
  }

  async getTxRecord(txId: string): Promise<TccRecord> {
    return this.tccRecordRepo.findOneBy({ txId });
  }
}
```
3. 库存微服务 stock-service（参与者，TCC 三个接口）
```ts
// stock.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class StockService {
  /**
   * Try：预留库存，冻结
   * @param txId 全局事务ID（幂等key）
   * @param goodsId 商品
   * @param num 数量
   */
  async tryLockStock(txId: string, goodsId: number, num: number) {
    console.log(`【Stock Try】txId:${txId}, 冻结商品${goodsId},数量${num}`);
    // 数据库操作：update stock set locked = locked + num where total >= locked + num
    // 幂等判断：如果该txId已经执行过try，直接返回成功，防止重复调用
    return true;
  }

  /**
   * Confirm：确认扣减库存，释放冻结
   */
  async confirmStock(txId: string, goodsId: number, num: number) {
    console.log(`【Stock Confirm】txId:${txId},确认扣减库存`);
    // update stock set total = total - num, locked = locked - num
    return true;
  }

  /**
   * Cancel：解冻库存，回滚预留
   */
  async cancelStock(txId: string, goodsId: number, num: number) {
    console.log(`【Stock Cancel】txId:${txId},解冻库存`);
    // update stock set locked = locked - num
    return true;
  }
}
```
补充. 反正空回滚，空悬挂，需要每个微服务本地有一张`tcc_local_record`表
```ts
CREATE TABLE `tcc_local_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tx_id` varchar(64) NOT NULL COMMENT '全局事务id',
  `status` varchar(20) NOT NULL COMMENT 'INIT,TRY_SUCCESS,CONFIRMED,CANCELLED',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tx_id` (`tx_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='参与者本地TCC记录，用于空回滚、防悬挂';
```

```ts
// src/tcc/entities/tcc-local-record.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TccLocalStatus {
  INIT = 'INIT',
  TRY_SUCCESS = 'TRY_SUCCESS',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('tcc_local_record')
export class TccLocalRecord {
  @PrimaryGeneratedColumn('bigint')
  id: number;

  @Column({ length: 64, unique: true })
  txId: string;

  @Column({ length: 20 })
  status: TccLocalStatus;

  @CreateDateColumn()
  createTime: Date;
  @UpdateDateColumn()
  updateTime: Date;
}
```

```ts
// src/tcc/tcc-local.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TccLocalRecord, TccLocalStatus } from './entities/tcc-local-record.entity';

@Injectable()
export class TccLocalService {
  constructor(
    @InjectRepository(TccLocalRecord)
    private readonly localRecordRepo: Repository<TccLocalRecord>,
  ) {}

  async getLocalRecord(txId: string): Promise<TccLocalRecord> {
    return this.localRecordRepo.findOneBy({ txId });
  }

  async createOrUpdate(txId: string, status: TccLocalStatus) {
    const record = await this.getLocalRecord(txId);
    if (record) {
      await this.localRecordRepo.update({ txId }, { status });
    } else {
      await this.localRecordRepo.save({ txId, status });
    }
  }
}

```

4. 订单服务 order-service（协调器，TCC 主逻辑）
```ts
// order.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TccService } from '../tcc/tcc.service';
import { TccLocalService } from '../tcc/tcc-local.service';
import { StockService } from '../stock/stock.service';
import { TccTxStatus } from '../tcc-status.enum';
import { Order } from './entities/order.entity';
import { TccLocalStatus } from '../tcc/entities/tcc-local-record.entity';

@Injectable()
export class OrderService {
  constructor(
    private readonly tccService: TccService,
    private readonly tccLocalService: TccLocalService, // 新增本地TCC记录
    private readonly stockService: StockService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async createOrder(goodsId: number, num: number) {
    const txId = await this.tccService.createTxRecord();
    console.log('全局事务ID：', txId);

    try {
      // Try阶段
      await this.orderTry(txId, goodsId, num);
      await this.stockService.tryLockStock(txId, goodsId, num);

      // Confirm阶段
      await this.orderConfirm(txId);
      await this.stockService.confirmStock(txId, goodsId, num);

      await this.tccService.updateStatus(txId, TccTxStatus.CONFIRMED);
      console.log('TCC事务提交成功');
      return { success: true, txId };
    } catch (e) {
      console.error('TCC Try阶段失败，执行Cancel回滚', e);
      await this.orderCancel(txId);
      await this.stockService.cancelStock(txId, goodsId, num);
      await this.tccService.updateStatus(txId, TccTxStatus.CANCELLED);
      return { success: false, txId, msg: '事务回滚' };
    }
  }

  /**
   * Order Try：【增加防悬挂逻辑】
   * 如果本地记录已经是CANCELLED，说明已经收到Cancel，拒绝执行Try，防止悬挂
   */
  async orderTry(txId: string, goodsId: number, num: number) {
    console.log(`【Order Try】txId:${txId} 创建预订单`);
    const localRecord = await this.tccLocalService.getLocalRecord(txId);

    // ========== 防悬挂核心判断 ==========
    if (localRecord?.status === TccLocalStatus.CANCELLED) {
      console.log(`【防悬挂】txId=${txId} 已经被取消，拒绝执行Try`);
      return; // 直接返回，不再预留资源
    }
    // 幂等：已经TRY_SUCCESS，直接返回
    if (localRecord?.status === TccLocalStatus.TRY_SUCCESS) {
      return;
    }

    // 执行业务：创建预订单
    const existOrder = await this.orderRepo.findOneBy({ txId });
    if (existOrder) return;

    const order = new Order();
    order.txId = txId;
    order.goodsId = goodsId;
    order.num = num;
    order.status = 'PENDING';
    await this.orderRepo.save(order);

    // 标记本地Try成功
    await this.tccLocalService.createOrUpdate(txId, TccLocalStatus.TRY_SUCCESS);
  }

  async orderConfirm(txId: string) {
    console.log(`【Order Confirm】txId:${txId} 确认订单`);
    const localRecord = await this.tccLocalService.getLocalRecord(txId);
    // 幂等：已经确认，直接返回
    if (localRecord?.status === TccLocalStatus.CONFIRMED) return;

    const order = await this.orderRepo.findOneBy({ txId });
    if (!order || order.status === 'SUCCESS') return;

    await this.orderRepo.update({ txId }, { status: 'SUCCESS' });
    await this.tccLocalService.createOrUpdate(txId, TccLocalStatus.CONFIRMED);
  }

  /**
   * Order Cancel：【空回滚判断】
   * 如果本地没有Try记录，说明Try没有执行，是空回滚，只标记CANCELLED，不执行业务回滚
   */
  async orderCancel(txId: string) {
    console.log(`【Order Cancel】txId:${txId} 取消预订单`);
    const localRecord = await this.tccLocalService.getLocalRecord(txId);

    // ========== 空回滚核心判断 ==========
    if (!localRecord) {
      console.log(`【空回滚】txId=${txId} 未执行Try，只标记CANCELLED，不做业务回滚`);
      // 写入本地记录状态CANCELLED，用于后续防悬挂
      await this.tccLocalService.createOrUpdate(txId, TccLocalStatus.CANCELLED);
      return;
    }

    if (localRecord.status === TccLocalStatus.CANCELLED) {
      return; // 幂等，已经取消
    }

    // 正常Cancel：Try已经执行，需要回滚业务
    const order = await this.orderRepo.findOneBy({ txId });
    if (!order || order.status === 'CANCELLED') return;
    await this.orderRepo.update({ txId }, { status: 'CANCELLED' });

    await this.tccLocalService.createOrUpdate(txId, TccLocalStatus.CANCELLED);
  }

  async compensate() {
    const pendingList = await this.tccService.tccRecordRepo.findBy({
      status: TccTxStatus.TRYING,
    });
    for (const record of pendingList) {
      const txId = record.txId;
      console.log(`补偿任务处理悬挂事务 txId:${txId}`);
      const order = await this.orderRepo.findOneBy({ txId });
      const localRecord = await this.tccLocalService.getLocalRecord(txId);

      if (localRecord?.status === TccLocalStatus.TRY_SUCCESS && order?.status === 'PENDING') {
        await this.orderConfirm(txId);
        await this.stockService.confirmStock(txId, order.goodsId, order.num);
        await this.tccService.updateStatus(txId, TccTxStatus.CONFIRMED);
      } else {
        await this.orderCancel(txId);
        await this.stockService.cancelStock(txId, 0, 0);
        await this.tccService.updateStatus(txId, TccTxStatus.CANCELLED);
      }
    }
  }
}

```

### 空回滚
1. 协调器发 Try → 网络超时，协调器这边判定 Try 失败
2. 协调器立刻调用参与者 Cancel（这就是**空回滚**：参与者此时还没收到 Try，没有预留任何资源）
3. 参与者收到 Cancel：本地没有 `tcc_local_record`（没有 Try 记录），于是**只插入一条本地记录标记 `CANCELLED`，不做任何业务回滚操作**
4. 隔了一段时间，**迟到的 Try 请求才到达参与者**
5. 参与者收到迟到 Try，查询本地 `tcc_local_record`，发现状态已经是 `CANCELLED` → **直接拒绝执行 Try，不预留资源**（这一步就是**防悬挂**）
> 区分两个阶段
- 收到 Cancel 的时候：**空回滚**处理（只写 CANCEL 标记，不回滚业务）
- 迟到的 Try 到达的时候：**防悬挂**处理（拒绝执行 Try）

### TCC生产重点
1.txtId全局唯一，所有服务都用它做幂等、事务记录，是TCC的核心。
2.三大可靠性保障
> 空回滚 = Cancel 来了，Try 还没来，不能瞎回滚；
> 悬挂 = 已经 Cancel 了，迟到 Try 又来了，不能让它预留资源。
 - 幂等：Confirm/Cancel 允许重复调用，重复执行不会产生脏数据
 - 空回滚：Try 没有成功，Cancel 调用不能报错（逻辑是查不到记录就不继续了）
 - 防悬挂：Cancel 先到，Try 后到达，Try 拒绝执行（可在 TccRecord 增加状态判断）
3. **协调器故障**：上面这个简化例子是**同步协调器**；生产环境协调器宕机，Confirm/Cancel 没执行，需要**定时任务扫描 TccRecord 表，重试 Confirm/Cancel**。
4. **业务侵入大**：需要修改业务表结构（增加冻结字段），每个微服务都要开发 3 套接口。
> TCC：Try 预锁定资源，**强一致性**，适合资金、库存扣减场景；侵入高

> SAGA：没有资源锁定，**最终一致性**，只做补偿，适合长流程业务

5.对比SpringBoot TCC
SpringBoot TCC 一般用 Seata TCC，用注解 `@TwoPhaseBusinessAction` 声明 Try/Confirm/Cancel，底层框架自动管理 txId、状态机；
NestJS 没有成熟 TCC 框架，一般**自己手写 TCC 状态机 + 事务记录表**，和上面示例一致。

## AT / TCC / Saga 横向对比

| 方案 | 核心原理 | 代码侵入 | 隔离性 | 性能 | 存储依赖 | 典型问题 |
| --- | --- | --- | --- | --- | --- | --- |
| **Seata AT** | 一阶段业务 + undoLog，二阶段自动提交 / 回滚 | 极低，注解驱动 | 读未提交，存在脏读 | 较好 | MySQL InnoDB | 长事务锁、undo 日志，Node 生态弱 |
| **TCC** | Try 预留、Confirm 确认、Cancel 取消，业务自己实现三阶段 | 极高，每个参与者写 3 套接口 | 好，Try 阶段资源冻结 | 一般，多轮 RPC | 任意存储（MySQL/Redis/Mongo 都行） | 开发量大，需要处理空回滚、悬挂、幂等 |
| **Saga** | 真实执行业务，失败执行反向补偿；分编排 / 编排 | 中等，需要写补偿接口 | 差，中间状态对外可见 | 高，无资源锁定 | 任意存储 | 补偿逻辑开发，业务中间状态可见，无锁 |

> 
> 简单一句话区分：
> 
> 
> - AT：数据库自动帮你记录回滚镜像，业务代码最简单（仅限 MySQL）
> - TCC：业务自己冻结资源，自己写三阶段，**无数据库限制**，开发成本最高
> - Saga：直接执行业务，出错反向补偿，没有资源冻结，中间状态会暴露

## 生产选型指南 + NestJS vs SpringBoot 差异

### 1. SpringBoot 技术栈（Java）

✅ **首选：Seata AT**

- Seata 原生 Java，生态完善，TC、RM、TM 成熟，大量生产落地
- 业务代码只需要加注解，开发成本最低，MySQL 微服务优先选 AT
- 高并发秒杀场景：**TCC**（自己控制资源冻结，避免长事务锁）
- 长流程、复杂业务（订单履约、多步骤工作流）：**Saga 编排**

### 2. NestJS（Node.js）技术栈

> 
> ⚠️ 重点：`seata-nodejs` 社区维护弱，很多生产环境不敢直接用 AT！

1. 如果**数据库全是 MySQL，团队简单，愿意踩 seata-nodejs 坑**：可以选 AT
2. **绝大多数 Nest 生产项目，分布式事务优先选 TCC 或者 Saga**
   - 短事务、需要隔离、Redis/Mongo 参与事务：**TCC**（就是我们前面写的那套带 tcc_record、tcc_local_record，防悬挂空回滚）
   - 长流程业务，能接受中间状态可见：**Saga 编排**

### 选型决策口诀

1. SpringBoot + MySQL + 普通电商业务：**优先 Seata AT**
2. NestJS / 多数据源（Redis/Mongo）/ 高并发：**优先 TCC**
3. 长流程业务，步骤多，允许中间状态暴露：**Saga**
4. 秒杀等高并发：TCC（AT 长事务锁容易压垮数据库）
5. 非 MySQL 数据库：**不能用 AT，只能 TCC/Saga**

### 大型电商【高并发下单】完整架构分层
```
【接入层】
SLB(负载均衡) → Gateway集群（N实例，无状态）

【业务微服务层】
API网关路由到各个微服务集群（全部无状态，可水平扩容）
├─ 订单服务集群 order-service * N
├─ 库存服务集群 stock-service * N
├─ 用户/账户服务集群 account-service * N
├─ 商品服务 goods-service * N
└─ 其他：支付、物流、优惠券等

【消息队列（异步解耦，削峰）】
MQ集群（RocketMQ/Kafka）
消费端：消息消费服务集群，处理非实时任务：短信、消息、积分、日志

【存储层】
MySQL：分库分表集群（多个主库，每个主库挂多个从库，读写分离）
Redis：Redis Cluster集群（分片，缓存、分布式锁、热点库存）
【额外组件】
- 注册中心：Nacos/Eureka（微服务注册发现）
- 配置中心：Nacos/Apollo
- 熔断限流：Sentinel / Resilience4j（网关+微服务内部限流熔断）
- 链路追踪：SkyWalking / Pinpoint
- 分布式事务：Seata AT / TCC / Saga（根据选型）
```