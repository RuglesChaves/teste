'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    categoria: { type: String, uppercase: true },
    pergunta: { type: String, uppercase: true },
    resposta: { type: String }
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('faq', schema);

module.exports = Model;
