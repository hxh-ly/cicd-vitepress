## nest文件上传

```
npm install -D @types/multer
```

AaaController 添加这样一个 handler

```ts
@Post('aaa')
@UseInterceptors(FileInterceptor('aaa', {
    dest: 'uploads'
}))
uploadFile(@UploadedFile() file: Express.Multer.File, @Body() body) {
    console.log('body', body);
    console.log('file', file);
}
```

nest 支持跨域

```js
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}
bootstrap();
```

试下多文件上传

```ts
@Post('bbb')
@UseInterceptors(FilesInterceptor('bbb', 3, {
    dest: 'uploads'
}))
uploadFiles(@UploadedFiles() files: Array<Express.Multer.File>, @Body() body) {
    console.log('body', body);
    console.log('files', files);
}
```

如果有多个文件字段呢

```ts
@Post('ccc')
@UseInterceptors(FileFieldsInterceptor([
    { name: 'aaa', maxCount: 2 },
    { name: 'bbb', maxCount: 3 },
], {
    dest: 'uploads'
}))
uploadFileFields(@UploadedFiles() files: { aaa?: Express.Multer.File[], bbb?: Express.Multer.File[] }, @Body() body) {
    console.log('body', body);
    console.log('files', files);
}
```

如果不知道有哪些字段是 files

```js
@Post('ddd')
@UseInterceptors(AnyFilesInterceptor({
    dest: 'uploads'
}))
uploadAnyFiles(@UploadedFiles() files: Array<Express.Multer.File>, @Body() body) {
    console.log('body', body);
    console.log('files', files);
}
```

验证

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <script src="https://unpkg.com/axios@0.24.0/dist/axios.min.js"></script>
  </head>
  <body>
    <input id="fileInput" type="file" multiple />
    <script>
      const fileInput = document.querySelector("#fileInput");

      async function formData() {
        const data = new FormData();
        data.set("name", "aaa");
        data.set("age", 20);
        data.set("aaa", fileInput.files[0]);

        const res = await axios.post("http://localhost:3000/aaa", data);
        console.log(res);
      }
      async function formData2() {
        const data = new FormData();
        data.set("name", "aaa");
        data.set("age", 20);
        [...fileInput.files].forEach((item) => {
          data.append("bbb", item);
        });

        const res = await axios.post("http://localhost:3000/bbb", data, {
          headers: { "content-type": "multipart/form-data" },
        });
        console.log(res);
      }

      async function formData3() {
        const data = new FormData();
        data.set("name", "光");
        data.set("age", 20);
        data.append("aaa", fileInput.files[0]);
        data.append("aaa", fileInput.files[1]);
        data.append("bbb", fileInput.files[2]);
        data.append("bbb", fileInput.files[3]);

        const res = await axios.post("http://localhost:3000/ccc", data);
        console.log(res);
      }
      fileInput.onchange = formData;
    </script>
  </body>
</html>
```

指定 storage

```js
import * as multer from "multer";
import * as fs from "fs";
import * as path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      fs.mkdirSync(path.join(process.cwd(), "my-uploads"));
    } catch (e) {}

    cb(null, path.join(process.cwd(), "my-uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      "-" +
      file.originalname;
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

export { storage };
```

controller 使用 storage

```js
@Post('ddd')
@UseInterceptors(AnyFilesInterceptor({
    storage:storage
}))
uploadAnyFiles(@UploadedFiles() files: Array<Express.Multer.File>, @Body() body) {
    console.log('body', body);
    console.log('files', files);
}
```

限制上传文件，大小，类型(pipe 实现)

```
nest g pipe file-size-validation-pipe --no-spec --flat
```

```ts
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  transform(value: Express.Multer.File, metadata: ArgumentMetadata) {
    if (value.size > 10 * 1024) {
      throw new HttpException("文件大于 10k", HttpStatus.BAD_REQUEST);
    }
    return value;
  }
}
```

把它夹到 UploadFile 的参数里

```ts
@Post('eee')
@UseInterceptors(AnyFilesInterceptor({
    dest: 'uploads'
}))
uploadAnyFiles2(@UploadedFiles(FileSizeValidationPipe) files: Express.Multer.File, @Body() body) {
    console.log('body', body);
    console.log('files', files);
}
```

nest 封装好，直接用。

```js
@Post('fff')
@UseInterceptors(FileInterceptor('aaa', {
    dest: 'uploads'
}))
uploadFile3(@UploadedFile(new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: 1000 }),
      new FileTypeValidator({ fileType: 'image/jpeg' }),
    ],
})) file: Express.Multer.File, @Body() body) {
    console.log('body', body);
    console.log('file', file);
```

`ParseFilePipe`作用就是调用传入的 validator 来对文件做校验。

错误信息可以自己修改

```js
@Post('fff')
@UseInterceptors(FileInterceptor('aaa', {
    dest: 'uploads'
}))
uploadFile3(@UploadedFile(new ParseFilePipe({
    exceptionFactory:err=>{
        throw new HttpException('xx'+err,404)
    }
    validators: [
      new MaxFileSizeValidator({ maxSize: 1000 }),
      new FileTypeValidator({ fileType: 'image/jpeg' }),
    ],
})) file: Express.Multer.File, @Body() body) {
    console.log('body', body);
    console.log('file', file);
}
```

我们也可自己实现这样的 FileValidator

```js
import { FileValidator } from "@nestjs/common";
export class MyFileValidator extends FileValidator {
  constructor(options) {
    super(options);
  }
  isValid(file: Express.Multer.File): boolean | Promise<boolean> {
    if (file.size > 10000) {
      return false;
    }
    return true;
  }
  buildErrorMessage(file: Express.Multer.File): string {
    return `文件 ${file.originalname} 大小超出 10k`;
  }
}
```

然后在 controller 用一下

```js
@Post('hhh')
@UseInterceptors(FileInterceptor('aaa', {
    dest: 'uploads'
}))
uploadFile4(@UploadedFile(new ParseFilePipe({
    exceptionFactory:err=>{
        throw new HttpException('xx'+err,404)
    }
    validators: [
      new MyFileValidator()
    ],
})) file: Express.Multer.File, @Body() body) {
    console.log('body', body);
    console.log('file', file);
}
```

### 总结

Nest 的文件上传也是基于 multer 实现的，它对 multer api 封装了一层，提供了 FileInterceptor、FilesInterceptor、FileFieldsInterceptor、AnyFilesInterceptor 的拦截器，分别用到了 multer 包的 single、array、fields、any 方法。

它们把文件解析出来，放到 request 的某个属性上，然后再用 @UploadedFile、@UploadedFiles 的装饰器取出来传入 handler。

并且这个过程还可以使用 ParseFilePipe 来做文件的验证，它内置了 MaxFileSizeValidator、FileTypeValidator，你也可以实现自己的 FileValidator。

这就是 Nest 里处理文件上传的方式。


### 上传OSS方案
