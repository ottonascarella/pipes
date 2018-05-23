# Stream Pipes
A reactive stream implementation in Typescript

Bare minimum. Built only as a study: muscle for async thinking.

```ts
import { fromEvent, map, merge, scan, startWith } from 'src/index';

const plus$ = fromEvent('click', document.querySelector('.button-plus'));
const minus$ = fromEvent('click', document.querySelector('.button-minus'));

const span = document.querySelector('span');

plus$.pipe(
  map(x => +1),
  startWith(0),
  merge(minus$.pipe(map(y => -1), startWith(0))),
  scan((a,b) => a + b, 0)
).subscribe(n => span.textContent = n);
```

