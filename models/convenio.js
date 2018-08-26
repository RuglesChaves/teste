'use strict';
  
var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    _usuario: [{ type: mongoose.Schema.Types.ObjectId, ref: 'usuario' }],
    cadastro: Date,
    'atualizado-por': String, 
    _tabelapreco: [{ type: mongoose.Schema.Types.ObjectId, ref: 'tabelaprecos' }],
    _gerenciador: [{ type: mongoose.Schema.Types.ObjectId, ref: 'gerenciadordetabelas' }],
    nome: { type: String, uppercase: true },
    
});
schema.plugin(mongoosePaginate);


var Model = mongoose.model('convenio', schema);

module.exports = Model;
