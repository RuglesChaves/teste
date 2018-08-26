'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    nome: { type: String, uppercase: true },
    modelos: [{ type: String, uppercase: true }]
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('marca', schema);

module.exports = Model;
