import {Database} from "./Database";
import {Competence} from "./Competence";
import * as winston from "winston";
import {CompetenceHierarchy} from "./CompetenceHierarchy";

export async function generateTree(database: Database){
    let allCompetencies = await database.loadCompetencies();

    const groupedCompetencies: Array<CompetenceHierarchy> = [
        new CompetenceHierarchy("ict"),
        new CompetenceHierarchy("language"),
        new CompetenceHierarchy("transversal"),
        new CompetenceHierarchy("Core"),
        new CompetenceHierarchy("ict2"),
        new CompetenceHierarchy("multimedie"),
        new CompetenceHierarchy("GartnerForecast"),
        new CompetenceHierarchy("undefined"),
        new CompetenceHierarchy("_"),
        new CompetenceHierarchy("NULL"),
    ];
    let treeList = groupedCompetencies;

    for (let competence of allCompetencies){
        switch (competence.grp){
            case "ict":{
                groupedCompetencies[0].children.push(new CompetenceHierarchy(competence.name));
                break;
            }
            case "language":{
                groupedCompetencies[1].children.push(new CompetenceHierarchy(competence.name));
                break;
            }
            case "transversal":{
                groupedCompetencies[2].children.push(new CompetenceHierarchy(competence.name));
                break;
            }
            case "Core":{
                groupedCompetencies[3].children.push(new CompetenceHierarchy(competence.name));
                break;
            }
            case "ict2":{
                groupedCompetencies[4].children.push(new CompetenceHierarchy(competence.name));
                break;
            }
            case "multimedie":{
                groupedCompetencies[5].children.push(new CompetenceHierarchy(competence.name));
                break;
            }
            case "GartnerForecast":{
                groupedCompetencies[6].children.push(new CompetenceHierarchy(competence.name));
                break;
            }
            case "undefined":{
                groupedCompetencies[7].children.push(new CompetenceHierarchy(competence.name));
                break;
            }
            case "":{ //Problem here, it doesn't find any with an empty string, the ones with an empty string for value seem to have the value missing instead, which in my program lumps them in with NULL
                groupedCompetencies[8].children.push(new CompetenceHierarchy(competence.name));
                break;
            }
        }
        if (!competence.hasOwnProperty('grp')){ //Made separate due to the property not existing in the case of null, and the switch ALWAYS fell through to default despite there being breaks.
            groupedCompetencies[9].children.push(new CompetenceHierarchy(competence.name));
        }
    }

    for (let i = 0; i < groupedCompetencies.length; i++){
        treeList[i].children = await database.findSubCompetencies(groupedCompetencies[i].children, [])
    }
    treeList = removeLeaves(treeList);
    //winston.info(JSON.stringify(treeList));

    await database.storeShinyTreeJSON(JSON.stringify(treeList));
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