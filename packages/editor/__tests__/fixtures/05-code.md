# Code blocks

JavaScript:

```js
function hello(name) {
  return `Hello, ${name}!`;
}
console.log(hello("world"));
```

TypeScript:

```ts
interface User {
  id: string;
  email: string;
}

const user: User = { id: "1", email: "demo@memory.wiki" };
```

Python:

```python
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
```

Shell with no language:

```
$ npm run build
$ npm test
```

Inline `const x = 1;` works too.
