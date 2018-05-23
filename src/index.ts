type PredicateFn = (value: any) => boolean;
type BranchSubscriberFn = (value?: any) => void;

interface Subscription {
  unsubscribe(): void;
}

type StreamSubscriber = (
  next: BranchSubscriberFn,
  error?: BranchSubscriberFn,
  complete?: BranchSubscriberFn
) => Subscription;

type OperatorFn = (a: Stream<any>) => Stream<any>;

interface Stream<A> {
  subscribe: StreamSubscriber;
  pipe(...operators: OperatorFn[]): Stream<any>;
}

function createStream<A>(subscriber: StreamSubscriber): Stream<A> {
  return {
    subscribe(next, error, complete) {
      return subscriber(next, error, complete);
    },
    pipe: pipe
  };
}

function from(array: Array<any>): Stream<any> {
  return createStream((next, error, complete) => {
    let isComplete = false;
    // This should be a proper scheduler...
    setTimeout(() => {
      array.forEach(x => !isComplete && next(x));
      if (!isComplete && complete) complete();
      isComplete = true;
    }, 0);
    return {
      unsubscribe() {
        if (!isComplete && complete) complete();
        isComplete = true;
      }
    }
  })
}

function of(...array: Array<any>): Stream<any> {
  return from(array);
}

function fromEvent(eventName: string, element: any): Stream<any> {
  return createStream((next, error, complete) => {
    const handler = e => next(e);
    element.addEventListener(eventName, handler, false);
    return {
      unsubscribe() {
        element.removeEventListener(eventName, handler);
        if (complete) complete();
      }
    };
  });
}

function interval(msecs: number): Stream<number> {
  return createStream((next, error, complete) => {
    let i = 0;
    const interval = setInterval(() => {
      next(i++);
    }, msecs);
    return {
      unsubscribe() {
        clearInterval(interval);
        complete();
      }
    }
  });
}

function pipe<A, B>(...operators: OperatorFn[]): Stream<A | B> {
  const source: Stream<A> = this;
  return operators.reduce((res, trans) => trans(res), source);
}

function map<A, B>(fn: (value: A) => A | B) {
  return (input: Stream<A>): Stream<A | B> => {
    return createStream((next, error, complete) => {
      return input.subscribe(val => next(fn(val)), error, complete);
    });
  };
}

function filter<A>(predicate: PredicateFn) {
  return (input: Stream<A>): Stream<A> => {
    return createStream((next, error, complete) => {
      return input.subscribe((val) => {
        if (predicate(val)) {
          next(val);
        }
      }, error, complete);
    });
  }
}

function scan<A, B>(fn: (acc: A, value: B) => A, initial: A) {
  let acc: A = initial;
  return (input: Stream<B>): Stream<A> => {
    return createStream((next, error, complete) => {
      return input.subscribe(
        item => {
          acc = fn(acc, item);
          next(acc);
        },
        error,
        complete
      );
    });
  };
}

function chain<A, B>(fn: (value: A) => Stream<B>) {
  return (input: Stream<A>): Stream<B> => {
    return createStream((next, error, complete) => {
      let innerSub;

      const sub = input.subscribe(val => {
          innerSub && innerSub.unsubscribe();
          return (innerSub = fn(val).subscribe(x => next(x)));
        },
        error,
        complete
      );

      return {
        unsubscribe() {
          innerSub && innerSub.unsubscribe();
          sub && sub.unsubscribe();
        }
      };
    });
  };
}

function startWith<A>(value: A) {
  return (input: Stream<A>) => {
    return createStream((next, error, complete) => {
      next(value);
      return input.subscribe(next, error, complete);
    });
  };
}

function combine<A, B, C, D, E>(...others: Stream<B | C | D | E>[]) {
  return (input: Stream<A>): Stream<Array<A | B | C | D | E>> => {

    const all = [input, ...others];
    const nil = {};
    const resp = Array(all.length).fill(nil);
    const subs = Array(all.length).fill(() => { });
    let allComplete = all.length;
    return createStream((next, error, complete) => {

      const tryEmit = () => {
        if (resp.every(v => v !== nil)) {
          next(resp);
        }
      };

      all.forEach((stream, i) => {
        subs[i] = stream.subscribe(x => {
          resp[i] = x;
          tryEmit();
        }, error, (...args) => {
          if (--allComplete === 0) {
            complete(...args);
          }
        });
      });

      return {
        unsubscribe() {
          subs.forEach(sub => sub.unsubscribe());
        }
      };
    });
  };
}

function merge<A, B, C, D, E>(...others: Stream<B | C | D | E>[]) {
  return (input: Stream<A>): Stream<A | B | C | D | E> => {
    const all = [input, ...others];
    const subs = Array(all.length).fill(() => { });
    let allComplete = all.length;

    return createStream((next, error, complete) => {

      all.forEach((stream, i) => {
        subs[i] = stream.subscribe(x => next(x), error, (...args) => {
          if (--allComplete === 0) {
            complete(...args);
          }
        });
      });

      return {
        unsubscribe() {
          subs.forEach(sub => sub.unsubscribe());
        }
      };
    });
  };
}


export {
  Stream,
  Subscription,
  createStream,
  interval,
  of,
  from,
  fromEvent,
  map,
  filter,
  scan,
  startWith,
  chain,
  merge,
  combine
};