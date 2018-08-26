'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
	tipo: String, // Credenciado, Permanência, Mensalista, Diarista
	tipo_veiculo: String,
	operador: String, // operador que cadastrou o ticket avulso
	carro: { // usado para avulso
		placa: { type: String, uppercase: true },
		cor: String,
		modelo: String,
		marca: String
	},
    excluido: {
        data: { type: Date, default: null },
        data_hora: { type: Date, default: null },
        _usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
        usuario: String,
        observacao: String
    },
	codigos: [String],
    imprimir_barras: Boolean,
    data_validade_inicio: { type: Date},
    data_validade_fim: { type: Date },
    quantidade_dia: { type: Number },
    data_cadastro: { type: Date, default: Date.now },
    pagamento: [{
        _id: mongoose.Schema.Types.ObjectId, 
    	_caixa: { type: mongoose.Schema.Types.ObjectId, ref: 'caixa' },
        _cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'cliente' }, 
        _cartao: { type: mongoose.Schema.Types.ObjectId, ref: 'cartao' },
        _equipamento: { type: mongoose.Schema.Types.ObjectId, ref: 'equipamento' },
        nome: String,
        operador: { type: String },
        data_vencimento: Date,
        data_registro: Date,
        data_pagamento: Date,
        pago: Boolean,
        tipo: String,
        valor: String,
        quantidade_dia: Number,
        valor_recebido: String,
        troco: String,
        forma_pagamento: String,
        observacao: String,
        tabela: {
            _id: String,
            nome: String,
        },
        excluido: {
            _usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
            data: { type: Date, default: null },
            data_hora: { type: Date, default: null },
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
        }
    }],
	_terminal: { type: mongoose.Schema.Types.ObjectId, ref: 'terminal' },
	terminal: {
		nome: { type: String, uppercase: true },
		numero: String
	}
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('diaria', schema);

module.exports = Model;
