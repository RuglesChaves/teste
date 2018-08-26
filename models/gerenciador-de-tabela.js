'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    
    'validar-por': String, //pode ser entrada ou saida
    _usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
    'ultima-atualizacao': Date,
	nome: String,
	ativo: Boolean,
	padrao: Boolean,
	configs: [{
		_id: false,
		hora_inicio: String,
		hora_fim: String,
		_tabela: { type: mongoose.Schema.Types.ObjectId, ref: 'tabelaprecos' },
		dias: [String], // Segunda-Feira; Terça-Feira; Quarta-Feira; Quinta-Feira; Sexta-Feira; Sábado; Domingo; Feriado
		zerar_permanencia: { type: Boolean, default: false }
	}]
	
    
});

schema.plugin(mongoosePaginate);

var Model = mongoose.model('gerenciadordetabelas', schema);

module.exports = Model;
