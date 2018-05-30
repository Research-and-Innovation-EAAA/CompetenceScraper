class ICompetence {
    _id : number | undefined;
    altLabels: string | undefined;
    conceptUri: string | undefined;
    description: string | undefined;
    protected name: string | undefined;
    prefferredLabel: string | undefined;
    defaultSearchPatterns: string | undefined;
    grp: string | undefined;
}

export default class Competence extends ICompetence {

    set<K extends keyof ICompetence>(key: K, value: ICompetence[K]): void {
        this[key] = value;
    }

    get<K extends keyof ICompetence>(key: K) : ICompetence[K] {
        return this[key];
    }

    constructor(initialValues : object = {}) {
        super();

        // assign initial values
        Object.keys(initialValues).forEach(key => {
            let k = key as keyof ICompetence;
            this.set(k, (initialValues as any)[k]);
        });
    }
}

