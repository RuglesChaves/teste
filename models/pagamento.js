'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId, 
	_caixa: { type: mongoose.Schema.Types.ObjectId, ref: 'caixa' },
    _cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'cliente' }, 
    _diaria: { type: mongoose.Schema.Types.ObjectId, ref: 'diaria' },
    _cartao: { type: mongoose.Schema.Types.ObjectId, ref: 'cartao' },
    _equipamento: { type: mongoose.Schema.Types.ObjectId, ref: 'equipamento' },
    _usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
    nome: String,
    codigos: [String],
    operador: { type: String },
    data_vencimento: Date,
    data_registro: Date,
    data_pagamento: Date,
    pago: Boolean,
    tipo: String,
    valor: String,
    valor_recebido: String,
    troco: String,
    forma_pagamento: String,
    observacao: String,
    tabela: {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'tabelaprecos' },
        nome: String,
        hora: String,
    },
    excluido: {
        _usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
        data: { type: Date, default: null },
        observacao: String
    },
    nota_fiscal: {
        rps: { type: String },
        total_pis: { type: String },
        total_cofins: { type: String },
        total_iss: { type: String },
        cpf_cnpj: { type: String  },
        email: { type: String  },
        ambiente: { type: String },
        total_impostos: { type: String },
        status: { type: String, uppercase: true },
        data_envio: { type: Date },
        data_emissao: { type: Date },
        numero: { type: String },
        observacao: { type: String, uppercase: true }
    },
    cartao: {
        rede_adiquirente: { type: String, default: null },
        transacao: { type: String, default: null },
        autorizacao: { type: String, default: null },
        mensagem_operador: { type: String, default: null },
        codigo_controle: { type: String, default: null },
        tipo_cartao: { type: String, default: null },
        tipo_pagamento: { type: String, default: null },
        numero_cartao: { type: String, default: null },
        nome_cartao: { type: String, default: null },
        numero_terminal: { type: String, default: null },
    }
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('pagamento', schema);

module.exports = Model;
