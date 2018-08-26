'use strict';
  
var mongoose            = require('mongoose'),
    mongoosePaginate    = require('mongoose-paginate');

var schema = new mongoose.Schema({
    cadastro: Date,
    '_tabela-de-preco': {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'tabelaprecos' },
        nome: String
    },
    valor: String,
    quantidade: Number,
    total: String,
    forma_pagamento: String,
    _usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
    nome_usuario: String,
    _caixa: { type: mongoose.Schema.Types.ObjectId, ref: 'caixa' },
    _terminal: { type: mongoose.Schema.Types.ObjectId, ref: 'terminal' },
    ip: String,
    _pagamentos:[{ type: mongoose.Schema.Types.ObjectId, ref: 'pagamento' }]
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('pagamento-em-massa', schema);

module.exports = Model;