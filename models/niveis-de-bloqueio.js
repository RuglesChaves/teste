'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    'validar-por': String, //pode ser entrada ou saida
    _usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
    'ultima-atualizacao': Date,
    nome: { type: String, uppercase: true },
    
    configs:[{
        _id : false,
        hora_inicio: String,
        hora_fim: String,
        sentido: { type: String, default: 'ACESSO LIVRE' },
        dias: [{ type: String }],
       
    }]
}); 
schema.plugin(mongoosePaginate);

var Model = mongoose.model('niveis-de-bloqueio', schema);

module.exports = Model;
