## Redis

因为 mysql 存在硬盘，并且会执行 sql 的解析，会成为系统的性能瓶颈，所以我们要做一些优化。
计算机领域最经常考虑到的性能优化手段就是缓存了。能不能把结果缓存在内存中，下次只查内存就好了呢
所以做后端服务的时候，我们不会只用 mysql，一般会结合内存数据库来做缓存，最常用的是 redis。
因为需求就是缓存不同类型的数据，所以 redis 的设计是 key、value 的键值对的形式。
并且值的类型有很多：字符串（string）、列表（list）、集合（set）、有序集合（sorted set)、哈希表（hash）、地理信息（geospatial）、位图（bitmap）等。

官方的 RedisInsight，它号称是最好的 Redis GUI 工具：

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

## nest 里操作 Redis

创建项目

```shell
nest new nest-redis -p npm
# 下载
npm install redis
```

在 AppModule 添加自定义的 provider

```js
import {createClient} from 'redis'
@Module({
    providers:[
        AppService,
        {
            provide:'REDIS_CLIENT',
            async useFactory() {
                const client = createClient({
                    socket:{
                        host:'localhost',
                        port:6379
                    }
                })
                await client.connect();
                return client;
            }
        }
    ]
})
```

注入到 service 里用就好了

```js
import {RedisClientType} from 'redis';
export class AppService{
    @Inject("REDIS_CLIENT")
    private redisClient:RedisClientType;
    async getHello() {
    const value = await this.redisClient.keys('*');
    console.log(value);

    return 'Hello World!';
  }
}
```

### redis 配置

```js
// 
const client = createClient({
  url: `redis://${
    config.password
      ? `${config.username}:${encodeURIComponent(config.password)}@`
      : ""
  }${config.host}:${config.port}`,
});
```
