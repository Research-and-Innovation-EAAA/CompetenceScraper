export class CompetenceHierarchy{
    text: string;
    children: Array<CompetenceHierarchy>;

    constructor(text: string){
        this.text = text;
        this.children = [];
    }
}
