# @nestjs/microservices

## 内置 Transport 枚举全部类型

### RPC Remote Procedure Call，远程过程调用
> 简单来说 调用另一台机器上的函数，就跟调用本地函数一样简单
> 本地调用：函数就在当前进程，直接内存执行。
> RPC：函数跑在另一台服务器；你写代码看起来像普通函数，底层网络帮你完成跨机器通信。
> 核心目标：屏蔽网络细节，像调用本地方法一样调用远程服务的逻辑
RPC 完整底层发生了什么（4 步）

1. 客户端（调用方）。把函数标识、入参（userId）做**序列化**，打包成二进制 / 消息包，通过网络发出去。
2. 网络传输（TCP / Redis /gRPC）送到远端服务。
3. 服务端（被调用方）。收到数据包，反序列化，找到对应的方法 `getUserInfo`，执行业务函数。
4. 把返回结果再次序列化，传回客户端；客户端反序列化得到结果。

||REST‑HTTP 接口|RPC|
|---|---|---|
|调用形式|http 请求 url，JSON body|调用远程方法 / 函数|
|关注点|资源、url代表资源|方法、函数动作|
|数据载体|json为主|json/protobuf（gRPC）|
|元数据|http method、 statusCode|消息头、异常元信息|


### Transport.TCP

- 简单原生 TCP 长连接，Nest 自己封装消息帧；RPC 模型，点对点调用
- ✅优点：**不需要额外中间件**，开箱即用，本地调试很方便
- ❌缺点：无消息持久化、没有负载均衡、无死信，**生产多集群不推荐**
- 适合：简单单体拆分、本地开发测试

### Transport.REDIS

利用 Redis Pub/Sub 做微服务传输
#### Pub/Sub 发布订阅
Redis Pub/Sub 是**内存广播机制，消息不落地、不持久化**，适合实时广播通知；**不是可靠消息队列**。Nest 的 Redis 微服务就是封装这套能力。业务如果要求消息不丢失，不能直接依赖原生 PubSub。
> 类比广播电台 
> 发布者 = 电台，向**频道**广播节目；
> 订阅者 = 收音机，调到这个频道就能收到；
> 没有收音机在听，广播发出去就直接丢弃。
```js
const app = await NestFactory.createMicroservice(AppModule, {
  transport: Transport.REDIS,
  options: {
    url: "redis://localhost:6379",
  },
});
```
RedisContext**最核心作用：通配订阅场景，获取消息实际发送的 Redis Channel**；
**Redis PubSub 底层没有消息头，所以 RedisContext 拿不到 headers，元数据只能放在 payload 里面**，这是和 Kafka/NATS 最大区别。

- 模式：pub/sub，RPC 调用 + 事件推送
- ✅优点：很多项目本身就有 Redis，不用新增中间件，部署成本低
- ❌注意：Redis PubSub**消息不持久化**，消费者离线消息直接丢；不是队列。
- 适合：内部服务简单通信，事件通知。


### Transport.NATS

NATS 消息服务器，轻量高性能消息总线，云原生常用。分为两大块：
1. **Core NATS（核心 NATS）**：默认内存模式，**消息不持久化，最多一次投递**。基于 `subject（主题）`，支持发布订阅、请求应答（RPC）、**队列组（Queue Groups）**；支持主题通配符 `*`、`>`。
2. **JetStream（NATS 的持久化层）**：可选开启，提供消息持久化、消费者组、ack 确认、消息重放，把 NATS 变成可靠消息流。
> 核心概念：`subject`（主题，类似 redis channel，用`.`分层 `order.created`）
```ts
transport: Transport.NATS,
options: { servers: ['nats://localhost:4222'] }
```

#### 队列组的用法
> 同一主题、相同 queue 名称的所有实例，构成队列组，消息随机发给组内一个实例。
```js
// main.ts
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.NATS,
    options: {
      servers: ['nats://127.0.0.1:4222'],
      // ✅ 队列组名称，多个实例都填同样queue名字，实现负载均衡
      queue: 'order_queue', 
    },
  });
  await app.listen();
  console.log('NATS微服务启动，队列组 order_queue');
}
bootstrap();
```
```js
// app.controller.ts
import { Controller, MessagePattern, Payload, Ctx, EventPattern } from '@nestjs/microservices';
import { NatsContext } from '@nestjs/microservices';

@Controller()
export class AppController {

  // RPC请求应答模式
  @MessagePattern('order.get')
  getOrder(@Payload() payload: { id: number }, @Ctx() ctx: NatsContext) {
    const subject = ctx.getSubject();
    const headers = ctx.getHeaders();
    console.log('收到消息，subject=', subject, 'headers=', headers);
    return { id: payload.id, name: '订单' };
  }

  // 通配订阅示例 order.*
  @EventPattern('order.*')
  handleOrderEvent(@Payload() data: any, @Ctx() ctx: NatsContext) {
    const realSubject = ctx.getSubject();
    console.log('原始subject：', realSubject);
  }
}
```
> 运行：启动 2 份这个服务实例，queue 都写`order_queue`。生产者发送消息到`order.get`，**只会其中一个实例收到消息**，实现负载均衡。如果**不写 queue**，两个实例都会收到同一条消息（普通广播）。
#### NatsContext里有
1. `getSubject()`：**最常用**，拿到消息投递的原始 subject 主题。通配订阅场景必用（装饰器写`order.*`，拿到真实的`order.created`）
2. `getHeaders()`：**获取 NATS 消息头对象**（NATS 原生支持 headers！Redis PubSub 没有 header），放 traceId、version、tenantId，链路追踪用。
3. `getMessage()`：获取底层原生 nats 消息对象 `Msg`，里面有 data、reply 主题等底层信息。

#### NatsRecordBuilder构建器
> 构建包装对象，携带的playload + NATS消息headers
```js
/ client端，在nest服务内部调用微服务
import { ClientProxy, NatsRecordBuilder } from '@nestjs/microservices';
import { Inject, Injectable } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import * as nats from '@nats-io/nats-core';

@Injectable()
export class ClientService {
  @Inject('NATS_SERVICE')
  private readonly client: ClientProxy;

  async sendOrder() {
    // 构造headers
    const headers = nats.headers();
    headers.set('x-trace-id', 'trace-123456');
    headers.set('x-version', '1.0.0');

    // NatsRecordBuilder：载荷 + headers
    const record = new NatsRecordBuilder({ id: 1001 })
      .setHeaders(headers)
      .build();

    // 发送RPC请求
    const result = await this.client.send('order.get', record).toPromise();
    console.log('返回结果', result);
  }
}
```

- ✅高性能，支持请求应答、发布订阅、队列分组 
- NATS 是高性能消息总线，**Queue Group 队列组是它核心能力，实现多实例负载均衡**，非常适合 Nest 微服务 RPC 水平扩容。
- `NatsContext` 可以拿到**原始 subject + 消息 headers**，做链路追踪非常方便（Redis PubSub 做不到 header）。
- 适合：大规模微服务事件总线，云原生集群

### Transport.MQTT

物联网常用协议，基于 MQTT broker（emqx/mosquitto）

```ts
transport: Transport.MQTT,
options: { url: 'mqtt://localhost:1883' }
```

- 特点：支持 QoS（消息投递保障），设备场景首选
- 适合：IoT 设备上报、设备指令下发

### Transport.GRPC
> gRPC 是标准化 RPC，带 IDL 强契约、protobuf 二进制、HTTP/2 流能力，适合多语言混合的企业级微服务内网调用。
谷歌 gRPC，基于 protobuf 二进制 RPC

什么时候选gRPC(选型)
- 多语言混合微服务（比如 Node 服务调用 Go/Java 服务）
- 内网高频服务间调用，追求低延迟
- 需要流式传输（实时数据推送）
- 团队需要严格接口契约，自动校验类型

#### 优势
1. 强契约 IDL（`.proto`文件）
2. Protobuf 二进制序列化。 对比 JSON 文本：包体积更小，序列化 / 反序列化速度更快，内网高频调用性能更好。
3. HTTP/2 多路复用 + 原生 4 种通信模型
- 一元调用（Unary）：一问一答（普通 RPC，最常用）
- 服务端流式：服务持续推流（日志、实时监控）
- 客户端流式：客户端批量上传
- **双向双向流（bidirectional stream）**：双方同时收发消息（IM 实时通信）
4. 原生元数据 Metadata（类似 HTTP header，NATS headers 的同类，但 gRPC 标准）
5. 内置标准能力 负载均衡、健康检查、调用取消、超时、TLS 加密、服务网格（istio）原生适配。
#### 示例
```protobuf
syntax = "proto3";
// 包名，隔离命名空间
package hero;

// 定义服务，里面包含rpc方法
service HeroesService {
  // 一元rpc：调用FindOne，入参HeroById，返回Hero
  rpc FindOne (HeroById) returns (Hero) {}
}

// 请求消息（入参）
message HeroById {
  int32 id = 1;
}

// 返回消息（返回体）
message Hero {
  int32 id = 1;
  string name = 2;
}
```
```js
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'hero', // 和proto里面的package名字保持一致
      protoPath: join(__dirname, 'hero/hero.proto'), // proto文件路径
      url: '0.0.0.0:50051', // grpc默认端口 50051
    },
  });
  await app.listen();
  console.log('gRPC microservice listening on 50051');
}
bootstrap();
```
```js
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class AppController {
  // @GrpcMethod(服务名, 方法名)，和proto里定义对应
  @GrpcMethod('HeroesService', 'FindOne')
  findOne(data: { id: number }) {
    // data就是HeroById，protobuf自动解析成js对象
    const items = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Doe' },
    ];
    return items.find((item) => item.id === data.id);
  }
}
```
```js
// app.module.ts（客户端模块）
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ClientService } from './client.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'HERO_PACKAGE', // 注入token
        transport: Transport.GRPC,
        options: {
          package: 'hero',
          protoPath: join(__dirname, 'hero/hero.proto'),
        },
      },
    ]),
  ],
  providers: [ClientService],
})
export class AppModule {}
```
```js
// client.service.ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

// 定义客户端接口，和proto对应
interface HeroesServiceClient {
  findOne(data: { id: number }): Observable<{ id: number; name: string }>;
}

@Injectable()
export class ClientService implements OnModuleInit {
  private heroesService: HeroesServiceClient;

  @Inject('HERO_PACKAGE')
  private readonly client: ClientGrpc;

  onModuleInit() {
    // 拿到gRPC服务存根stub
    this.heroesService = this.client.getService<HeroesServiceClient>('HeroesService');
  }

  async callGrpc() {
    // 调用远程gRPC方法
    const res = await firstValueFrom(this.heroesService.findOne({ id: 1 }));
    console.log('grpc返回结果', res);
    return res;
  }
}

```


- 强类型，二进制，跨语言，自带服务发现、流（stream）
- 缺点：需要维护`.proto`文件，学习成本高
- 适合：多语言异构微服务，高性能服务间 RPC 调用

### Transport.KAFKA

高吞吐消息流平台，分布式日志流

```ts
transport: Transport.KAFKA,
options: {
  client: { brokers: ['localhost:9092'] }
}
```

- ✅消息持久化、分区、高吞吐、可回溯消费，支持海量事件
- 适合：大数据、日志、订单事件流，高可靠事件驱动架构

| Transport | 是否需要中间件  | 通信模型               | 适用场景                 |
| --------- | --------------- | ---------------------- | ------------------------ |
| TCP       | ❌              | 点对点 RPC             | 本地调试、简单小服务     |
| Redis     | ✅ Redis        | PubSub + RPC           | 已有 Redis，轻量内部通信 |
| NATS      | ✅ NATS         | PubSub/RPC             | 云原生微服务事件总线     |
| MQTT      | ✅ MQTT Broker  | PubSub(QoS) IoT 物联网 |
| gRPC      | ❌              | RPC(protobuf)          | 跨语言、强契约高性能调用 |
| Kafka     | ✅ Kafka 事件流 | 高吞吐、持久化事件     |
