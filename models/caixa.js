'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');


var schema = new mongoose.Schema({
	_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
	usuario: { type: String },
    data_inicio: { type: Date, default: Date.now },
    data_fim: { type: Date },
    valor_inicio: { type: String, default: '0,00' },
    valor_fim: { type: String, default: '0,00' },
    saldo: { type: String, default: '0,00' },
    valor_entrada: { type: String, default: '0,00' },
    valor_saida: { type: String, default: '0,00' },
    finalizado: { type: Boolean, default: false },
    observacao: { type: String },
    categoria: { 
        'Diária': {
            'total': { type: String, default: '0,00' },
            'quantidade': { type: Number, default: 0 }
        },
    	'Permanência': {
    		'total': { type: String, default: '0,00' },
    		'quantidade': { type: Number, default: 0 }
    	},
        'Pré-Pago': {
            'total': { type: String, default: '0,00' },
            'quantidade': { type: Number, default: 0 }
        },
        'Mensalista': {
            'total': { type: String, default: '0,00' },
            'quantidade': { type: Number, default: 0 }
        }
    },
    forma_pagamento: {
    	'Dinheiro': {
    		'total': { type: String, default: '0,00' },
    		'quantidade': { type: Number, default: 0 }
    	},
    	'Cartão de Crédito': {
    		'total': { type: String, default: '0,00' },
    		'quantidade': { type: Number, default: 0 }
    	},
    	'Cartão de Débito': {
    		'total': { type: String, default: '0,00' },
    		'quantidade': { type: Number, default: 0 }
    	}
    }
});

schema.plugin(mongoosePaginate);


var Model = mongoose.model('caixa', schema);


module.exports = Model;
