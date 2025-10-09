console.log(process);
process.stdin.on("data", (data) => {
  console.log(`You typed: ${data}`);
  setTimeout(() => {
    process.stdout.write('hello world '+data);
  }, 3000);
});
console.log(process.cwd())