'use strict';

var helper = require('../config/helper');
var config = require('../config');
var moment 	= require('moment');

var Cliente = require('../models/cliente');
var Cartao = require('../models/cartao');
var Equipamento = require('../models/equipamento');
var Terminal = require('../models/terminal');
var Caixa = require('../models/caixa');

// require default controller
var controller 	= require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'inicio',
	menu			: '',
	pageName		: '',
	pageNamePlural	: config.app().title,
	model 			: 'cartao'
});

function recuperaPagamento(req, callback) {
	if(req.options.permission['inicio'] && (req.options.permission['inicio'].indexOf('dashboard-pagamento') > -1 || req.options.permission['inicio'].indexOf('dashboard-faturamento') > -1)) {
			req.options.forma_pagamento = {
				Dinheiro: 0,
				'Cartão de Crédito': 0,
				'Cartão de Débito': 0
			};
			req.options.forma_pagamento_total = 0;
			req.options.tipo_pagamento = {
				'Permanência': 0,
				'Diária': 0,
				Mensalidade: 0,
				'Pré-Pago': 0
			};
			req.options.tipo_pagamento_total = 0;


 			// filtra os pagamentos de hoje 
 			
			// Caixa.aggregate(pipeline, function (err, result) {
			// 	for (var i = result.length - 1; i >= 0; i--) {
					
			// 		if(req.options.permission['inicio'].indexOf('dashboard-pagamento') > -1) {
			// 			req.options.forma_pagamento[result[i].pagamento.forma_pagamento] += helper.moeda2float(result[i].pagamento.valor);
			// 			req.options.forma_pagamento_total += helper.moeda2float(result[i].pagamento.valor);
			// 		}

			// 		if(req.options.permission['inicio'].indexOf('dashboard-faturamento') > -1) {
			// 			req.options.tipo_pagamento[result[i].pagamento.tipo] += 1;
			// 			req.options.tipo_pagamento_total += 1;			
			// 		}
			// 	}


			    callback();
			// });	
	} else
		callback();
}

function recuperaCaixa(req, callback) {
	if(req.options.permission['inicio'] && req.options.permission['inicio'].indexOf('dashboard-caixa') > -1) {
		Caixa.find({data_fim: null}).exec(function(err, result) {
			req.options.relatorio_caixa = result;
			callback(err);
		});
	} else
		callback();
}

function recuperaCliente(req, callback) {
	if(req.options.permission['inicio'] && req.options.permission['inicio'].indexOf('dashboard-cliente') > -1) {
		Cliente.find({'ativo': 1}).exec(function(err, result) {
			req.options.tipo_cliente = {
				Mensalista: 0,
				Credenciado: 0,
				'Pré-Pago': 0,
			};

			req.options.tipo_cliente_total = 0;

			if(!err && result) {
				for (var i = 0; i < result.length; i++) {
					if(result[i].tipo) 
						req.options.tipo_cliente[result[i].tipo] += 1
					req.options.tipo_cliente_total += 1;
				}
			}

			// console.log(req.options.tipo_cliente);

			callback(err);
		});
	} else
		callback();
}

function recuperaVaga(req, callback) {
	if(req.options.permission['inicio'] && req.options.permission['inicio'].indexOf('dashboard-vaga') > -1) {
		Cartao.find({data_fim: null, 'excluido.data_hora': null}).sort({$natural: -1}).exec(function(err, result) {

			req.options.vaga = {
				quantidade: 0,
				porcentagem: 0,
				disponivel: 0,
				cor: '#000'
			};

			if(req.options.configuracao && req.options.configuracao.patio && req.options.configuracao.patio.quantidade_vagas) {
				req.options.vaga.quantidade = req.options.configuracao.patio.quantidade_vagas;

				if(result && !err) {
					req.options.vaga.ocupada = result.length;
				} else
				req.options.vaga.ocupada = 0;

				req.options.vaga.porcentagem = parseInt((100 * req.options.vaga.ocupada) / req.options.vaga.quantidade);
				req.options.vaga.disponivel = req.options.vaga.quantidade - req.options.vaga.ocupada;
				if(req.options.vaga.disponivel <= 0) req.options.vaga.disponivel = '0';

				if(req.options.vaga.porcentagem < 50)
					req.options.vaga.cor = '#87b87f';
				if(req.options.vaga.porcentagem > 50)
					req.options.vaga.cor = '#000';
				if(req.options.vaga.porcentagem >= 100)
					req.options.vaga.cor = '#d15b47';

				req.options.vaga.cor = '#fff';
			}

			callback(err);
			
		});
	} else
		callback();
}

function recuperaEquipamento(req, callback) {
	if(req.options.permission['inicio'] && req.options.permission['inicio'].indexOf('dashboard-equipamento') > -1) {
		Equipamento.find().sort({'status': -1, 'nome': 1}).exec(function(err, result) {
			if(!err && result)
				req.options.equipamentos = result;

			callback(err);
		});
	} else
		callback();
}

function recuperaTerminal(req, callback) {
	if(req.options.permission['inicio'] && req.options.permission['inicio'].indexOf('dashboard-terminal') > -1) {
		Terminal.find().sort({'status': -1, 'nome': 1}).exec(function(err, result) {
			if(!err && result)
				req.options.terminais = result;

			callback(err);
		});
	} else
		callback();
}

// override default methods
Controller.read = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
		req.options.title = req.options.configuracao.empresa.razao_social;		
		req.options.breadCrumb = [
		{ 
			'route': '/inicio',
			'pageName': 'Início'
		}
		];

		recuperaVaga(req, function() {
			recuperaEquipamento(req, function() {
				recuperaTerminal(req, function() {
					recuperaCliente(req, function() {
						recuperaPagamento(req, function() {
							recuperaCaixa(req, function() {
								res.render(self.route, req.options);
							});
						});
					});
				});
			});
		});

	};
};

// expose this inherited controller
module.exports = Controller;
