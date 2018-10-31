import {Database} from "./Database";
import * as winston from "winston";
import {CompetenceHierarchy} from "./CompetenceHierarchy";
import {isNull} from "util";

export async function generateTree(database: Database){
    let allCompetencies = await database.loadCompetencies();

    const groupedCompetencies: Array<string> = await database.findDistinctGroups();
    let tree = new CompetenceHierarchy("Alle kompetencer");
    for (let group of groupedCompetencies){
        if (isNull(group)){
            tree.children.push(new CompetenceHierarchy("NULL"));
        }
        else{
            tree.children.push(new CompetenceHierarchy(group));
        }
    }

    for (let competence of allCompetencies){
        for (let i = 0; i < tree.children.length; i++){
            if (competence.grp == tree.children[i].text){
                tree.children[i].children.push(new CompetenceHierarchy(competence.prefferredLabel));
            }
            else if (!competence.hasOwnProperty('grp') && tree.children[i].text == "NULL"){
                tree.children[i].children.push(new CompetenceHierarchy(competence.name));
            }
        }
    }

    for (let i = 0; i < groupedCompetencies.length; i++){
        tree.children[i].children = await database.findSubCompetencies(tree.children[i].children, [])
    }
    tree.children = removeLeaves(tree.children);

    //winston.info(JSON.stringify(tree));
    await database.storeShinyTreeJSON(JSON.stringify(tree));
}

function removeLeaves(competenceTree: Array<CompetenceHierarchy>){

    let removeUs: Array<number> = [];

    for (let i = 0; i < competenceTree.length; i++){
        if (competenceTree[i].children.length > 0){
            competenceTree[i].children = removeLeaves(competenceTree[i].children);
        }
        else{
            removeUs.push(i);
        }
    }

    for (let i = removeUs.length-1; i >= 0; i--){
        competenceTree.splice(removeUs[i], 1)
    }
    return competenceTree;
}
