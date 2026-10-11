# 消息队列

1. RabbitMQ：业务任务队列（AMQP协议），Broker做路由推送，擅长人物解构，复杂路由、死信、延迟任务，**Push推送模型** 消费ACK后消息默认删除。
```mermaid
graph TD
    Producer[生产者 Producer] -->|发布消息| Exchange[Exchange 交换机<br/>Direct / Topic / Fanout]

    Exchange -->|binding 绑定| Q1[Queue 业务队列1]
    Exchange -->|binding 绑定| Q2[Queue 业务队列2]
    Exchange -->|binding 绑定| DLQ[DLQ 死信队列]

    Q1 --> Worker1[消费者 Worker‑1]
    Q2 --> Worker2[消费者 Worker‑2]
    DLQ --> DeadWorker[死信处理消费者]

    Worker1 -.ACK确认.-> Q1
    Worker2 -.ACK确认.-> Q2

    note1[消息ACK后删除；broker push推送模型]
```

2. Kafka：流式日志平台，磁盘顺序写，高吞吐，pull拉取模型。消息消费完依旧磁盘留存，可以回溯重放。不擅长复杂业务路由。

```mermaid
graph LR
    P1[生产者 P1] --> Topic[Topic 主题]
    P2[生产者 P2] --> Topic

    Topic --> P0[Partition‑0 有序日志]
    Topic --> P1[Partition‑1 有序日志]
    Topic --> P2[Partition‑2 有序日志]

    subgraph CG1[消费组 Group‑A]
        C1[Consumer A‑1]
        C2[Consumer A‑2]
    end
    subgraph CG2[消费组 Group‑B]
        Cb[Consumer B‑1]
    end

    P0 -->|pull拉取维护offset| C1
    P1 -->|pull拉取维护offset| C2
    P2 -->|pull拉取维护offset| C1

    P0 -->|独立offset，可重放| Cb
    P1 --> Cb
    P2 --> Cb

    noteKafka[消息追加写磁盘，消费不删除；按保留时间过期]

```

3. BullMQ（redis-Stream）：Node轻量任务队列，基于Redis，专门为Job任务，重试，死信、延迟、优先级开箱即用。
```mermaid
graph LR
    NestApp[NestJS 业务服务] -->|addJob提交任务| Redis[(Redis)]

    Redis --> MainQueue[主任务队列]
    MainQueue -->|执行失败/重试耗尽| DLQ[死信队列]
    MainQueue -->|延迟任务| DelayQueue[延迟任务队列]

    subgraph Worker进程组
        W1[Worker‑1]
        W2[Worker‑2]
    end

    MainQueue --> W1
    MainQueue --> W2
    DelayQueue --> W1

    W1 -.XACK任务完成.-> MainQueue
    W2 -.XACK任务完成.-> MainQueue

    noteBull[开箱：重试、延迟、优先级、死信；基于Redis]
```


## 核心指标对比表
|对比维度|RabbitMQ|Kafka|BullMQ|
|---|---|---|---|
|设计定位|业务消息中间件|分布式事件流平台|Node任务队列|
|模型|Push推送|Pull拉取|混合，任务驱动|
|吞吐量|单机万级/s|单机百万级/s|十万级（受Redis内存）|
|消息存储|消息ACK后删除，不长期保存|磁盘持久化，消费完依旧保留，支持回溯|Redis内存+持久化，堆积大容易OOM|
|路由能力|极强：direct/topic/fanout/header|弱，仅topic+partition key|简单，按队列名|
|死信/重试|原生支持DLQ|需要业务自己实现|开箱即用DLQ、重试、延迟任务|
|顺序性|单个队列有序|单个partition有序|单队列有序|
|运维复杂度|中等。自带web管理|高，集群调度复杂|极低，复用已有Redis|
|Nest集成|@nestjs/rabbitmq|@nestjs/kafka|@nestjs/bullmq|

## 关键概念区分
1， Push vs Pull
- RabbitMQ：Broker 主动推消息给消费者；消费者处理慢会压垮 Broker。
- Kafka：消费者主动拉取，可以自己控制消费速率，不怕消费慢，消息存在磁盘

2. 消息是否删除
RabbitMQ：ACK 之后消息删除，不能重新消费历史消息。
Kafka：消息不管消费与否，等到保留时间才删除，可以修改 offset 重放几天前的数据。

3. 死信 DLQ
- RabbitMQ 原生支持；BullMQ 原生支持；Kafka 没有原生 DLQ，业务代码捕获异常把失败消息写入新 topic。

选型一句话总结
业务异步任务、定时、重试死信，Nest+Redis → BullMQ
微服务复杂业务路由，多语言，独立中间件 → RabbitMQ
日志采集、大数据流、海量事件，需要多组消费者重放历史 → Kafka


死信DLQ:
> 通俗：正常队列处理不了的消息，扔到死信队列，留着人工排查/补偿；直接丢弃会丢业务数据
什么消息会变成死信

1. 重试次数耗尽
2. 消息过期：设置了过期时间，一直没人消费
3. 队列满了，消息无法入队
4. 消息被拒绝，不允许宠你像你返回原队列

RabbitMQ原生支持死信，给普通队列配置`dead-letter-exchange` 当消息变成死信，自动转发到死信交换机，路由到DLQ队列
- 需要单独写消费者监听DLQ：告警、记录数据库、人工修复后重新投递
```mermaid
graph LR
    Producer --> NormalQ[普通业务队列]
    NormalQ -->|重试耗尽 / 过期| DLX[死信交换机]
    DLX --> DLQ[DLQ死信队列]
    DLQ --> ConsumerDL[死信消费者：告警、记录、重放]
```

### BullMQ
> 适合：AI调用报错、计划提醒任务异常、不会直接丢任务
```mermaid
flowchart LR
    Client["HTTP 客户端"] --> Controller["Nest Controller"]
    Controller --> Service["MailService 生产者"]
    Service --> Producer["BullMQ Queue 实例：mail"]
    Producer -->|"add：配置 attempts 和 backoff"| Waiting

    subgraph RedisStore["Redis：任务数据与状态"]
        Waiting["mail：waiting 等待任务"]
        Active["mail：active 执行中"]
        Delayed["mail：delayed 延迟重试"]
        Completed["mail：completed 成功任务"]
        Failed["mail：failed 最终失败任务"]
        Events["事件流：Redis Streams"]
        DLQ["mail-dlq：自建死信队列"]
    end

    subgraph NestCluster["Nest 多实例部署：竞争消费"]
        Worker1["Worker 实例 1：@Processor('mail')"]
        Worker2["Worker 实例 2：@Processor('mail')"]
    end

    Waiting -->|"原子领取任务并加锁"| Active
    Active --> Worker1
    Active --> Worker2

    Worker1 --> Business["业务处理：邮件 / OSS / 数据库"]
    Worker2 --> Business
    Business --> Result{"执行结果"}

    Result -->|"成功"| Completed
    Result -->|"失败且允许继续重试"| Retry{"是否设置退避延迟"}
    Retry -->|"是"| Delayed
    Retry -->|"否"| Waiting
    Delayed -->|"到期重新等待"| Waiting
    Result -->|"次数耗尽或不可重试"| Failed

    Failed -.->|"失败事件"| Events
    Events -.-> Monitor["QueueEvents：监听与告警"]

    Failed --> Transfer["业务补偿程序：扫描最终失败任务并幂等转存"]
    Transfer -->|"显式添加任务"| DLQ
    DLQ --> DLQWorker["DLQ Worker：记录与告警"]
    DLQWorker --> Manual["人工排查 / 修复 / 审批重放"]
    Manual -->|"重新投递；业务须幂等"| Producer
```
#### 完整示例
```shell
npm install @nestjs/bullmq bullmq
```
> 架构说明：
> 1.Redis 作为消息存储中心，**生产者和 Worker 可以部署在不同服务 / 多实例**
> 2.多 Worker 竞争消费任务，自动负载均衡，不会重复消费
> 3.任务失败 → 自动重试；重试耗尽 → 进入死信队列，用于告警人工处理
app.module.ts 全局注册 BullMQ 连接 + 注册队列
```js
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailConsumer } from './mail/mail.consumer';
import { MailService } from './mail/mail.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
        // password: 'xxx', // 生产redis密码
      },
    }),
    // 注册主队列 mail
    BullModule.registerQueue({
      name: 'mail',
    }),
    // 注册死信队列
    BullModule.registerQueue({
      name: 'mail-dlq',
    }),
  ],
  providers: [MailService, MailConsumer],
  controllers: [],
})
export class AppModule {}
```
生产者 service：mail.service.ts（入队任务） 
```js
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MailService {
  constructor(
    @InjectQueue('mail') private readonly mailQueue: Queue,
  ) {}

  /**
   * 发送邮件任务入队
   */
  async addSendEmailJob(to: string, title: string) {
    const job = await this.mailQueue.add(
      'send-email',
      { to, title }, // job业务数据
      {
        attempts: 3, // 总共尝试3次（首次执行 + 2次重试）
        backoff: {
          type: 'exponential', // 指数退避 1s → 2s →4s
          delay: 1000,
        },
        // 重试全部失败后转入死信队列
        deadLetterQueue: {
          name: 'mail-dlq',
        },
        removeOnComplete: { count: 100, age: 24 * 3600 }, // 成功任务保留24h，最多100条
        removeOnFail: { count: 500 },
      },
    );
    console.log('任务入队成功 jobId: ', job.id);
    return job;
  }

  // 延迟任务：10s后执行
  async addDelayEmailJob() {
    return this.mailQueue.add('send-email', { to:'test@xx.com', title:'延迟通知' }, { delay: 10000 })
  }

  // cron定时任务 每分钟执行
  async addCronJob() {
    return this.mailQueue.add('report', {}, { repeat: { pattern: '* * * * *' } })
  }
}
```
消费者 mail.consumer.ts
```js
import { Processor, WorkerHost, OnQueueCompleted, OnQueueFailed, OnQueueActive } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';

@Processor('mail') // 监听mail队列
@Injectable()
export class MailConsumer extends WorkerHost {
  // 实际任务处理入口
  async process(job: Job<{ to: string; title: string }>) {
    switch (job.name) {
      case 'send-email':
        console.log(`开始发送邮件: ${job.data.to}`);
        // 模拟业务，随机抛出异常测试重试
        if (Math.random() < 0.4) {
          throw new Error('邮件服务商临时失败');
        }
        await this.sendEmail(job.data.to, job.data.title);
        return { success: true };
      case 'report':
        console.log('执行定时报表任务');
        return;
    }
  }

  private async sendEmail(to: string, title: string) {
    // 真实调用邮件SDK
    console.log(`send email to ${to}, title:${title}`);
  }

  // ========== 队列事件监听 ==========
  @OnQueueActive()
  onActive(job: Job) {
    console.log(`任务开始执行: ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    console.log(`任务成功 ${job.id}, 返回结果`, result);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    console.log(`任务失败 ${job.id}, reason: ${err.message}, 已尝试次数:${job.attemptsMade}`);
  }
}
```
调用测试（Controller）
```js
import { Controller, Get } from '@nestjs/common';
import { MailService } from './mail/mail.service';

@Controller()
export class AppController {
  constructor(private readonly mailService: MailService) {}
  @Get('add-job')
  async add() {
    await this.mailService.addSendEmailJob('user@test.com', '订单通知');
    return '任务已入队';
  }
}
```
死信队列消费者（单独处理彻底失败任务）
```js
@Processor('mail-dlq')
export class MailDlqConsumer extends WorkerHost {
  async process(job: Job) {
    console.log('死信任务，人工排查：', job.id, job.data, job.failedReason);
    // 可以在这里告警，或者手动重放回原队列
  }
}
```
#### BullMQ JobFlow
> JobFlow 用来编排**有依赖关系的任务**
> 1.父任务执行完，**才启动子任务**；
> 2.多个子任务**并行执行**；
> 3.子任务全部完成后，还可以跑收尾任务；
> 4.子任务失败，父 / 整个流可以配置是否终止；
> 5.子任务能拿到父任务的返回结果。
>
> 适用场景：创建订单 → 扣库存 (并行) → 生成支付单 → 发送通知
> 文件处理：上传文件 → 解析内容 → 生成缩略图（并行多个尺寸）→ 打包推送消息

示例1:父任务执行完后，子任务并行执行
```js
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('workflow')
export class FlowConsumer extends WorkerHost {
  async process(job: Job) {
    console.log(`[${job.name}] jobId:${job.id}, data:`, job.data);

    switch (job.name) {
      case 'step-1-create-order':
        console.log('步骤1：创建订单');
        // 返回值可以被子任务拿到
        return { orderId: 'ORD_10001' };

      case 'step-2-deduct-stock':
        console.log('步骤2：扣库存，父任务结果', job.parent?.returnvalue);
        return { stockOk: true };

      case 'step-3-send-notify':
        console.log('步骤3：发送通知，拿到前面所有结果');
        return { notify: 'ok' };
    }
  }
}
```
```js
import { Injectable } from '@nestjs/common';
import { InjectFlowProducer } from '@nestjs/bullmq';
import { FlowProducer } from 'bullmq';

@Injectable()
export class FlowService {
  constructor(
    @InjectFlowProducer('workflow') private readonly flowProducer: FlowProducer,
  ) {}

  async createOrderFlow() {
    // 构建任务流
    const flow = await this.flowProducer.add({
      name: 'step-1-create-order',
      data: { goodsId: 999, userId: 123 },
      // 子任务数组，父成功之后才会执行
      children: [
        {
          name: 'step-2-deduct-stock',
          data: { goodsId: 999 },
          queueName: 'workflow',
        },
        {
          name: 'step-3-send-notify',
          data: { userId: 123 },
          queueName: 'workflow',
        },
      ],
    });

    console.log('flow根任务id：', flow.job.id);
    return flow;
  }
}
```
进阶：多层嵌套子任务（子任务还可以有自己的 children）
> parent 执行完 → childA 启动 ;     childA 执行完 → grandChild 启动
```js
const flow = await this.flowProducer.add({
  name: 'parent',
  data: {},
  children: [
    {
      name: 'childA',
      data: {},
      queueName: 'workflow',
      children: [
        { name: 'grandChild', data: {}, queueName: 'workflow' },
      ],
    },
  ],
});
```
#### 生产要点
📌 Redis 相关（最高优先级）
1.**Redis 宕机风险** BullMQ 全部任务存储在 Redis。如果 Redis 宕机：生产者 addJob 直接报错；Worker 无法消费。
- 开启 Redis AOF+RDB 持久化，防止断电丢任务；
- 生产建议 Redis 主从 / 哨兵，不要单机裸 Redis；
- Redis 丢失数据 = 队列任务全部丢失。
2.Redis内存打爆。任务堆积（Worker 处理不过来），大量 Job 占 Redis 内存。
- 设置 `removeOnComplete / removeOnFail`，不要无限保存历史 job；
- 监控队列 waiting /active/failed 数量；堆积过高告警。
3.Redis Cluster 支持：BullMQ 原生支持 Cluster，但是 key 需要 hash tag。

📌 Worker & 任务可靠性
1. **业务必须幂等** Worker 崩溃 stall 会重跑任务；多实例场景 job 可能重复执行。
> 比如：扣款、发短信，不能直接执行；建议每个 job 携带业务唯一 bizId，执行前先判断是否已经处理完成。
2. 任务不能是超长阻塞任务.单个任务不要跑几小时；如果耗时极长，尽量拆分成多个子 Job（Job Flow 任务流）。
> 长时间运行的任务容易被判定 stall，触发不必要重试。
3. `maxConcurrency` 并发控制.Worker 不要无限制并发，防止瞬间打满数据库、外部 API 连接池。
```js
// 注册队列，限制worker最多同时跑8个任务
BullModule.registerQueue({
  name:'mail',
  workerOptions:{
    maxConcurrency:8
  }
})
```
4.队列拆分隔离
- 短快任务（发通知）、慢重任务（视频转码、大报表）**分到不同队列**。
如果全部塞同一个队列，慢任务会阻塞紧急小任务。

总结
1. ✅生产者、Worker 可以分开部署：**同一机器不同进程，或者完全不同服务器，只要共用一套 Redis**。
2. Worker 挂掉：正在执行任务 stall，任务退回队列，存活 worker 重新执行；全部 worker 挂，任务保存在 Redis 等待恢复。
3. DLQ 就是普通 Queue；DLQ 消费者挂，任务堆积 Redis，恢复后消费；可以写代码手动重放死信任务。
4. 生产最大风险来源：Redis 丢失数据、任务没有幂等导致重复执行、任务堆积打爆 Redis、快慢任务共用队列互相阻塞。
