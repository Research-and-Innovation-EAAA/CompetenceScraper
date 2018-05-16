export default class Competence {
    constructor(public _id : number | undefined = undefined,
                public altLabels: string | undefined = undefined,
                public conceptUri: string | undefined = undefined,
                public description: string | undefined = undefined,
                public name: string | undefined = undefined,
                public prefferredLabel: string | undefined = undefined,
                //public kompetencecol: string | undefined = undefined,
                public grp: string | undefined = undefined) {
    }
}
