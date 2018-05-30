class _hiddenCompetence {
    _id : number | undefined;
    altLabels: string | undefined;
    conceptUri: string | undefined;
    description: string | undefined;
    name: string | undefined;
    prefferredLabel: string | undefined;
    defaultSearchPatterns: string | undefined;
    grp: string | undefined;
}

type Partial<T> = {
    [P in keyof T]?: T[P];
}

class _visibleCompetence extends _hiddenCompetence {

    set<K extends keyof _hiddenCompetence>(key: K, value: _hiddenCompetence[K]): void {
        this[key] = value;
    }

    get<K extends keyof _hiddenCompetence>(key: K) : _hiddenCompetence[K] {
        return this[key];
    }

    initializeValues(initialValues : Partial<_hiddenCompetence> = {}) {
        // assign initial values
        Object.keys(initialValues).forEach(key => {
            let k = key as keyof _hiddenCompetence;
            this.set(k, (initialValues as any)[k]);
        });
    }

    constructor() {
        super();
    }
}

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>

export interface Competence extends Omit<_visibleCompetence, keyof _hiddenCompetence> { }
export const Competence = _visibleCompetence as (new () => Competence);


