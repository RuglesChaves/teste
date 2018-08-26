'use strict';

var moment = require('moment');
var async = require('async');
var mongoose = require('mongoose');
var helper = require('../config/helper');
var config = require('../config');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route: 'relatorio-financeiro',
	menu: 'Relatórios',
	pageName: 'Relatório de Caixa',
	pageNamePlural: 'Relatório de Caixa',
	model: 'caixa'
});

// override default methods

Controller.geraRelatorio = function (req, res, next) {
	var Caixa = require('../models/caixa'),
		Pagamento = require('../models/pagamento'),
		Cartao = require('../models/cartao'),
		Usuario = require('../models/usuario'),
		TabelaDePreco = require('../models/tabela-preco'),
		options = req.options,
		self = this;

	req.query.data_inicio = req.query.data_inicio || moment().format('DD/MM/YYYY');
	req.query.data_fim = req.query.data_fim || moment().format('DD/MM/YYYY');

	options.query = req.query;

	var filterPagamento = {
		data_pagamento: {
			'$gte': moment(req.query.data_inicio + ' 00:00', 'DD/MM/YYYY HH:mm').toISOString(),
			'$lte': moment(req.query.data_fim + ' 23:59', 'DD/MM/YYYY HH:mm').toISOString()
		},
		'excluido.data': null,
		_caixa: {$exists: true}
	}

	if(req.query.tipo)
		filterPagamento.tipo = req.query.tipo;
	
	if(req.query.usuario)
		filterPagamento._usuario = mongoose.Types.ObjectId(req.query.usuario);

	//filtros de caixa
	var filterCaixa = {
		$or: [
			{
				data_inicio: {
					'$lte': moment(req.query.data_fim + ' 23:59', 'DD/MM/YYYY HH:mm').toISOString()
				},
				data_fim: {
					'$gte': moment(req.query.data_inicio + ' 00:00', 'DD/MM/YYYY HH:mm').toISOString()
				}
			},
			{
				data_inicio: {
					'$lte': moment(req.query.data_fim + ' 23:59', 'DD/MM/YYYY HH:mm').toISOString()
				},
				data_fim: null
			}
		]
	}
	if(req.query.usuario)
		filterCaixa._usuario = mongoose.Types.ObjectId(req.query.usuario);


	options.forma_pagamento = {
		Dinheiro: {
			total: 0,
			quantidade: 0
		},
		'Cartão de Crédito': {
			total: 0,
			quantidade: 0
		},
		'Cartão de Débito': {
			total: 0,
			quantidade: 0
		},
	};
	options.tipo_cliente = {
		'Permanência': {
			total: 0,
			quantidade: 0
		},
		// Credenciado: {
		// 	total: 0,
		// 	quantidade: 0
		// },
		'Diária': {
			total: 0,
			quantidade: 0
		},
		Mensalidade: {
			total: 0,
			quantidade: 0
		},
		'Pré-Pago': {
			total: 0,
			quantidade: 0
		},
	};
	options.tabela_de_preco = {};
	options.total = 0;
	
	var caixa_faturamento = {};


	console.log('====================FILTRO DE CAIXA====================')
	console.log(filterCaixa)
	console.log('=======================================================')
	console.log('==================FILTRO DE PAGAMENTO==================')
	console.log(filterPagamento)
	console.log('=======================================================')

	Usuario.find({}, function (err, usuario) {
		if (!err && usuario)
			options.usuario = usuario;
		
		TabelaDePreco.find({ ativo: true }, null, { sort: { nome: 1 } }).exec(function (err, tabelaDePreco) {
			if(!err && tabelaDePreco) {
				for(var key in tabelaDePreco) {
					options.tabela_de_preco[tabelaDePreco[key]._id] = {
						nome: tabelaDePreco[key].nome,
						total: 0,
						quantidade: 0
					}
				}
			}

			Pagamento.find(filterPagamento, function (err, relatorioPagamento) { // recupera todos os caixas do periodo
				
				if(relatorioPagamento && !err) {
					for(var key in relatorioPagamento) {
						var pagamento = relatorioPagamento[key];

						if(pagamento.valor && options.tipo_cliente && options.tipo_cliente[pagamento.tipo] && pagamento.forma_pagamento) {
							if(pagamento.forma_pagamento === 'Cartão de Debito')
								pagamento.forma_pagamento = 'Cartão de Débito';
							
							var valor = helper.moeda2float(pagamento.valor);

							options.total += valor;

							if(options.forma_pagamento[pagamento.forma_pagamento]) {
								options.forma_pagamento[pagamento.forma_pagamento].total += valor;
								options.forma_pagamento[pagamento.forma_pagamento].quantidade++;
							}

							if(options.tipo_cliente[pagamento.tipo]) {
								options.tipo_cliente[pagamento.tipo].total += valor;
								options.tipo_cliente[pagamento.tipo].quantidade++;
							}
							
							if(!caixa_faturamento[pagamento._caixa])
								caixa_faturamento[pagamento._caixa] = valor;
							else
								caixa_faturamento[pagamento._caixa] += valor;

							if(pagamento.tabela && pagamento.tabela._id) {
								if (options.tabela_de_preco[pagamento.tabela._id]) {
									options.tabela_de_preco[pagamento.tabela._id].total += valor;
									options.tabela_de_preco[pagamento.tabela._id].quantidade++;
								} else {
									options.tabela_de_preco[pagamento.tabela._id] = {
										nome: pagamento.tabela.nome,
										total: valor,
										quantidade: 1
									}
								}
							}

						}

					}
				}

				Caixa.find(filterCaixa, function(err, relatorioCaixa) { // recupera todos os caixas do periodo
					if(relatorioCaixa && !err)  {
						for(var key in relatorioCaixa) 
							if(caixa_faturamento[relatorioCaixa[key]._id])
								relatorioCaixa[key].faturamento = caixa_faturamento[relatorioCaixa[key]._id];
							
						options.relatorioCaixa = relatorioCaixa;			
					}
					
					if(options.pdf) {
						res.render(options.route, options, function (err, html) {
							if (!err && html)
								res.pdfFromHTML({
									filename: 'relatorio-financeiro.pdf',
									htmlContent: html,
									options: {
										width: '302px',
										height: '500px',
										border: 0,
										base: 'http://localhost:3333'
									}

								});
						});
					} else
						res.render(options.route, options);
				}); // caixa

			}); // pagamento
			
		}); // tabelaDePreco

	}); // usuario
};

Controller.print = function () {
	var self = this;

	return function (req, res, next) {
		req.options.route = self.route + '/print'; // view
		req.options.layout = 'print'; // layout

		if (req.query.printComPopup)
			req.options.printComPopup = true;

		if (req.query.pdf)
			req.options.pdf = true;

		self.geraRelatorio(req, res, next);
	};
};

Controller.read = function () {
	var self = this;

	return function (req, res, next) {
		req.options.printUrl = req.url.replace(self.route, self.route + '/print/');
		self.geraRelatorio(req, res, next);
	};
};

// expose this inherited controller
module.exports = Controller;
