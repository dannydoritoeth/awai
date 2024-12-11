const { Comparators } = require("langchain/chains/query_constructor");

const attributeInfo = [
    {
        name: "type",
        description: "The type of record (deal, lead, person, activity, note, organization)",
        type: "string"
    },
    {
        name: "source",
        description: "The source system (pipedrive, agentbox)",
        type: "string"
    },
    {
        name: "title",
        description: "The title or name of the record",
        type: "string"
    },
    {
        name: "status",
        description: "The status of the record",
        type: "string"
    },
    {
        name: "value",
        description: "The monetary value",
        type: "number",
        comparators: [Comparators.gt, Comparators.gte, Comparators.lt, Comparators.lte]
    },
    {
        name: "addTime",
        description: "When the record was created",
        type: "date"
    },
    {
        name: "updateTime",
        description: "When the record was last updated",
        type: "date"
    }
];

module.exports = attributeInfo; 