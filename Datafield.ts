
class IDatafield{
    _id: number | undefined;
    regexp: string | undefined;
    extract: string | undefined;
    name: string | undefined;
    lastUpdated: Date | undefined;
    lastMatch: Date | undefined;
}

type Partial<T> = {
    [P in keyof T]?: T[P];
}

export class Datafield extends IDatafield {

    setMore(values : Partial<IDatafield>) {
        Object.keys(values).forEach(key => {
            let k = key as keyof IDatafield;
            this.set(k, (values as any)[k]);
        });
    }

    set<K extends keyof IDatafield>(key: K, value: IDatafield[K]): void {
        this[key] = value;
    }

    get<K extends keyof IDatafield>(key: K) : IDatafield[K] {
        return this[key];
    }

    constructor(initialValues : Partial<IDatafield> = {}) {
        super();

        // assign initial values
        this.setMore(initialValues);
    }
}

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>
export interface Datafield extends Omit<Datafield, keyof IDatafield> { }
