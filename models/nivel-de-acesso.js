'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    nome: { type: String, uppercase: true },
    data_cadastro: { type: Date, default: Date.now },
	permissao:  {
		caixa: [String],
		ticket: [String],
		'tabela-de-preco': [String],
		cliente: [String],
		equipamento: [String],
		terminal: [String],
		usuario: [String],
		'nivel-de-acesso': [String],
		'niveis-de-bloqueio': [String],
		configuracao: [String],
		marca: [String],
		cor: [String],
		patio: [String],
		'tipo-veiculo': [String],
		'relatorio-mensalista': [String],
		'relatorio-caixa': [String],
		'relatorio-financeiro': [String],
		'relatorio-pagamento': [String],
		'relatorio-faturamento': [String],
		'relatorio-acesso': [String],
		'relatorio-patio': [String],
		'relatorio-permanencia': [String],
		'relatorio-ticket-excluido': [String],
		'relatorio-ticket-limpo': [String],
		'relatorio-ticket-perdido': [String],
		'relatorio-pagamento-em-massa': [String],
		'relatorio-isencao': [String], 
		'relatorio-convenio': [String], 
		'nota-fiscal': [String],
		'log-usuario': [String],
		'gerenciador-de-tabela': [String],
		feriado: [String],
		database: [String],
		perfil: [String],
		faq: [String],
		pagamento: [String],
		video: [String],
		inicio: [String],
		convenio: [String]
	}
 
});
schema.plugin(mongoosePaginate);


var Model = mongoose.model('nivel-de-acesso', schema);

module.exports = Model;
