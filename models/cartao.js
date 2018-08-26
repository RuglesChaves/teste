'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
	_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
	_cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'cliente' },
    _diaria: { type: mongoose.Schema.Types.ObjectId, ref: 'diaria' },
	nome: String, // nome é codigo(Permanência) ou nome do cliente(outros casos)
	tipo: String, // Credenciado, Permanência, Mensalista, Diarista
	tipo_veiculo: String,
	operador: String, // operador que cadastrou o ticket avulso
	carro: { // usado para avulso
		placa: { type: String, uppercase: true },
		cor: String,
		modelo: String,
		marca: String
	},
	perdido: { type: Boolean, default: false },
    limpo: { type: Boolean, default: false },
	excluido: {
		data_hora: { type: Date, default: null },
		_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
		usuario: String,
		observacao: String
	},
    convenio:{ 
        _tabelapreco: { type: mongoose.Schema.Types.ObjectId, ref: 'tabelaprecos' },
        nome_tabela: String,
        _gerenciador: { type: mongoose.Schema.Types.ObjectId, ref: 'tabelaprecos' },
        nome_gerenciador: String,
        _usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
        nome_usuario: String,
        _convenio: { type: mongoose.Schema.Types.ObjectId, ref: 'convenio' },
        data_cadastro: { type: Date },   
     
    },
	codigos: [String],
    liberado: Boolean,
    imprimir_barras: Boolean,
    permanencia: String,
    observacao: String,
    sempre_liberado: Boolean,
	data_inicio: { type: Date },
    data_validade_inicio: { type: Date},
    data_validade_fim: { type: Date },
    quantidade_dia: { type: Number },
	data_fim: { type: Date, default: null },
	// hora da baixa e quem deu a baixa
	limite_saida: { type: Date },
    data_cadastro: { type: Date, default: Date.now },
    tolerancia: { type: Boolean, default: false }, // cartao saiu na tolerancia
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
        valor_recebido: String,
        troco: String,
        forma_pagamento: String,
        observacao: String,
        tabela: {
            _id: { type: mongoose.Schema.Types.ObjectId, ref: 'tabelaprecos' },
            nome: String,
            hora: String,
        },
        'gerenciador-de-tabela': {
            _id: { type: mongoose.Schema.Types.ObjectId, ref: 'gerenciadordetabelas' },
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
        tef: {
            rede_adiquirente: { type: String, default: null },
            transacao: { type: String, default: null },
            autorizacao: { type: String, default: null },
            mensagem_operador: { type: String, default: null },
            codigo_controle: { type: String, default: null },
            impressao: { type: String, default: null },
            tipo_cartao: { type: String, default: null },
            tipo_pagamento: { type: String, default: null },
            numero_cartao: { type: String, default: null },
            nome_cartao: { type: String, default: null },
            nome: { type: String, default: null },
            numero_terminal: { type: String, default: null },
        }
    }],
    ticket: {
		linha1: String,
		linha2: String,
		linha3: String,
		linha4: String,
		linha5: String,
		linha6: String
	},
	_equipamento: { type: mongoose.Schema.Types.ObjectId, ref: 'equipamento' },
	equipamento: {
	    nome: { type: String, uppercase: true },
    	numero: Number
	},
	_terminal: { type: mongoose.Schema.Types.ObjectId, ref: 'terminal' },
	terminal: {
		nome: { type: String, uppercase: true },
		numero: String
	},
	_usuario_saida: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
	operador_saida: String, 
	_terminal_saida: { type: mongoose.Schema.Types.ObjectId, ref: 'terminal' },
	terminal_saida: {
		nome: { type: String, uppercase: true },
		numero: String
	},
	_equipamento_saida: { type: mongoose.Schema.Types.ObjectId, ref: 'equipamento' },
	equipamento_saida: {
	    nome: { type: String, uppercase: true },
    	numero: Number
	},
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('cartao', schema);

module.exports = Model;
