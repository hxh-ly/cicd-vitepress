# Mysql
```shell
# 如果记得密码
mysql -u root -p
# 没设置密码 直接回车
# 修改密码 每个命令都要加 分号
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_strong_password';
# 刷一下
FLUSH PRIVILEGES;
```