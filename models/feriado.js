'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    nome: String,
    'atualizado-por': String,
    cadastro: Date,
    'data-feriado': Date,
    'repetir-todo-ano': { type: Boolean, default: false }
    
});

schema.plugin(mongoosePaginate);

var Model = mongoose.model('feriado', schema);

module.exports = Model;
