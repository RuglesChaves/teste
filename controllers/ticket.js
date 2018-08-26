'use strict';

var helper = require('../config/helper');
var config = require('../config');
var moment = require('moment');

var Cartao 		 = require('../models/cartao'),
	Diaria 		 = require('../models/diaria'),
	Terminal 	 = require('../models/terminal'),
	Marca 		 = require('../models/marca'),
	Cor 		 = require('../models/cor'),
	TipoVeiculo  = require('../models/tipo-veiculo'),
	Terminal 	 = require('../models/terminal'),
	Configuracao = require('../models/configuracao'),
	Equipamento  = require('../models/equipamento'),
	PriceTable 	 = require('../models/tabela-preco');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'ticket',
	menu			: 'Cadastros',
	pageName		: 'Ticket',
	pageNamePlural	: 'Ticket',
	model 			: 'cartao'
});

Controller.customRoutes = function(app) {
	app.get('/'+this.route+'/print/:id', this.autentication(), this.default(), this.print())
	   .get('/'+this.route+'/pagamento/:id', this.autentication(), this.default(), this.printPagamento())
	   .get('/'+this.route+'/perdido/cadastrar', this.autentication(), this.permission('lost'), this.validation('lost'), this.default(), this.lost());
};

Controller.validation = function(resource) {
	var self = this;

	return function(req, res, next) {
		// console.log('ticket validation');
		
		switch(resource) {
			case 'print':
				// console.log(1);
				if(!req.params.id)
					res.json({err: 1, message: 'Desculpe, ocorreu um erro interno.'});
				else
					next();
			break;
			case 'update':

		   		Terminal.findOne({tipo: 'Entrada', ip: helper.getIp(req) /*$or:[{ip: ip}, {mac: mac}]*/}, function(err, terminal) {
		   			if(err || !terminal) {
		   				res.json({err: 1, status: 'error', message: 'Terminal não autorizado.'});
		   			} else {

						if(!req.body.carro.placa)
							res.json({err: 1, message: 'Informe a placa do veículo.'});
						else {
							req.body.carro.placa = req.body.carro.placa.toString().toUpperCase();

							// verifica se tem no patio excluindo esse q ta sendo editado
							// Cartao.findOne({'carro.placa': req.body.carro.placa, data_fim: null}, function(err, cartao) {
							// 	console.log(cartao);
							// 	if(err || cartao)
							// 		res.json({err: 1, message: 'Este veículo já se encontra no pátio.'});
							// 	else
							// 		next();
							// });
							next();
						}

					}
				});
			break;
			case 'create':
				if(req.body.carro.placa)
					req.body.carro.placa = req.body.carro.placa.toString().toUpperCase();

				var verificaTerminal = function(ip, perdido, callback) {
					if(perdido && perdido !== 'undefined') {
						callback(0, 'Para Ticket perdido o terminal não precisa estar autorizado a executar tarefas de "Entrada".');
					} else {
						Terminal.findOne({tipo: 'Entrada', ip: ip}, function(err, terminal) {
				   			if(err || !terminal)
				   				callback(1, 'O seu terminal '+ip+' não está autorizado para executar tarefas de "Entrada".');
				   			else
				   				callback(0, 'Terminal Autorizado.');
				   		});
					}
				};

				var verificaPlaca = function(placa, callback) {
					if(placa === 'undefined' || !placa)
						callback(0, 'Go');
					else {
						Cartao.findOne({'carro.placa': placa, data_fim: null, 'excluido.data_hora': null}, function(err, cartao) {
							if(err || cartao)
								callback(1, 'O veículo placa '+placa+' já se encontra no pátio.');
							else
								callback(0, 'OK');
						});
					}
				};

				var verificaCodigo = function(codigos, callback) {
					if(codigos === 'undefined' || !codigos)
						callback(0, 'Go');
					else {
						Cartao.findOne({'carro.codigos': codigos, 'excluido.data_hora': null}, function(err, cartao) {
							if(err || cartao)
								callback(1, 'O código '+codigos+' já foi utilizado.');
							else
								callback(0, 'OK');
						});
					}
				};

				var verificaDiariaPlaca = function(placa, callback) {
					if(placa === 'undefined' || !placa)
						callback(0, 'Go');
					else {
						Cartao.findOne({'carro.placa': placa, data_fim: null, 'excluido.data_hora': null}, function(err, cartao) {
							if(err || cartao)
								callback(1, 'O veículo placa '+placa+' já se encontra no pátio.');
							else
								callback(0, 'OK');
						});
					}
				};

				var verificaDiariaCodigo = function(codigos, callback) {
					if(codigos === 'undefined' || !codigos)
						callback(0, 'Go');
					else {
						Cartao.findOne({'carro.codigos': codigos, 'excluido.data_hora': null}, function(err, cartao) {
							if(err || cartao)
								callback(1, 'O código '+codigos+' já foi utilizado.');
							else
								callback(0, 'OK');
						});
					}
				};



				verificaTerminal(helper.getIp(req), req.body.perdido, function(err, message) {
					if(err)
						res.json({err: err, status: 'error', message: message});
					else
						verificaPlaca(req.body.carro.placa, function(err, message) {
							if(err)
								res.json({err: err, status: 'error', message: message});
							else
								verificaCodigo(req.body.codigos, function(err, message) {
									if(err)
										res.json({err: err, status: 'error', message: message});
									else {


										if(req.body.tipo === 'Permanência')
											next();
										else
											if(req.body.tipo === 'Diária') {
												verificaDiariaPlaca(req.body.carro.placa, function(err, message) {
													if(err)
														res.json({err: err, status: 'error', message: message});
													else
														verificaDiariaCodigo(req.body.codigos, function(err, message) {
															if(err)
																res.json({err: err, status: 'error', message: message});
															else
																next();
														});
												});
											}


									}
								});
						});
				});

			break;
			default: 
				next(); 
			break;
		}
	};
};

Controller.print = function() {
	var Model 			= require('../models/cartao'),
		self 			= this;

		return function(req, res, next) {
			req.options.layout = 'print';

			if(req.query.printComPopup) 
				req.options.printComPopup = true;

			Model.findOne({'_id': req.params.id/*, tipo: 'Permanência'*/}, function(err, result) {
				// se o params id nao estiver no banco cria um result com base no decodeBarcode

				if(!err && result) {
					var pattern = helper.decodeBarcode(result.codigos[0]);

					result = result.toObject();
					result.code = result.codigos[0];
					result.data = pattern.dia+'/'+pattern.mes;
					result.hora = pattern.hora+':'+pattern.minuto+':'+pattern.segundo;

		  	  		req.options.result = result;
		  	  		// req.options.printComPopup = true;
					res.render(self.route+'/print', req.options);
				}
			});
		};
};

Controller.printPagamento = function() {
	var Model 			= require('../models/cartao'),
		self 			= this;

		return function(req, res, next) {
			req.options.layout = 'print';

			if(req.query.printComPopup)
				req.options.printComPopup = true;

			Model.findOne({'_id': req.params.id}, function(err, result) {
				// se o params id nao estiver no banco cria um result com base no decodeBarcode

				if(!err && result) {
					var pattern = helper.decodeBarcode(result.codigos[0]);
					if(pattern) {
						result = result.toObject();
						result.code = result.codigos[0];
						result.data = pattern.dia+'/'+pattern.mes;
						result.hora = pattern.hora+':'+pattern.minuto+':'+pattern.segundo;
					} else {
						
					}

		  	  		req.options.result = result;

					res.render(self.route+'/pagamento', req.options);
				}
			});
		};
};

Controller.new = function() {
	var	self = this;

	return function(req, res, next) {
		req.options.isEdit = false;
		req.options.action = 'Cadastrar';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb.push({ 
			'route': '/'+self.route+'/cadastrar',
			'pageName': req.options.title });

		if(req.query.iframe === '1') {
			req.options.layout = 'iframe';
			req.options.iframe = true;
		}

		if(req.query.reload === '1')
			req.options.reload = true;

		if(req.query.findCard === '1')
			req.options.findCard = true;

		Marca.find({}, 'nome -_id', function(err, marcas) {
			Cor.find({}, 'nome -_id', function(err, cor) {
				TipoVeiculo.find({}, 'nome -_id', function(err, tipoVeiculo) {
					req.options.tipoVeiculo = tipoVeiculo;
					req.options.cor = cor;
					req.options.marca = marcas;
					req.options.modelo = [];
					res.render(req.options.route + '/show', req.options);
				});
			});
		});

	};
};

Controller.lost = function() {
	var self = this;

	return function(req, res, next) {
		req.options.isEdit = false;
		req.options.perdido = true;

		req.options.action = 'Cadastrar';
		req.options.title = req.options.action + ' Ticket Perdido';
		req.options.breadCrumb.push({ 
			'route': '/'+self.route+'/perdido/',
			'pageName': req.options.title });

		if(req.query.iframe === '1') {
			req.options.layout = 'iframe';
			req.options.iframe = true;
		}

		if(req.query.reload === '1')
			req.options.reload = true;

		if(req.query.findCard === '1')
			req.options.findCard = true;

		req.options.result = [];
		req.options.result.data_inicio = new Date();

		Marca.find({}, 'nome -_id', function(err, marcas) {
			Cor.find({}, 'nome -_id', function(err, cor) {
				TipoVeiculo.find({}, 'nome -_id', function(err, tipoVeiculo) {
					req.options.tipoVeiculo = tipoVeiculo;
					req.options.cor = cor;
					req.options.marca = marcas;
					req.options.modelo = [];
					res.render(req.options.route + '/show', req.options);
				});
			});
		});

	};
};

Controller.create = function() {
	var Model,
		route = this.route,
		self = this;



	return function(req, res, next) {
		console.log('criando ticket');
		var liberacao = require('../config/liberacao')(req.io);

		// function callback(mac) {
			var ip = helper.getIp(req);
	   		Terminal.findOne({
	   			$or:[{ip: ip}/*, {mac: mac}*/]
	   		}, function(err, terminal) {
	   			
	   			if(terminal) {
	   				var dataHora = null;
	   				var dataInicio = new Date();

	   				// so vem data e hora no ticket perdido
					if(req.body && req.body.data && req.body.data !== '' && req.body.hora && req.body.hora !== '') {
						dataHora = req.body.data+' '+req.body.hora;
						dataInicio = moment(dataHora, 'DD/MM/YYYY HH:mm').toISOString();
					}

					// console.log('\nController Ticket dataHora: '+dataHora);

					var numeroTerminal = terminal.numero;

					// console.log('-------');

					var barcode;
					console.log('req.body.codigos: '+req.body.codigos);
					if(req.body.codigos && req.body.codigos !== '' && req.body.codigos !== 'undefined') {
						barcode = req.body.codigos;
					} else {
						console.log('criando codigo de barras / numero do terminal: '+numeroTerminal+' data e hora: '+dataHora);
						barcode = helper.creteBarcode(numeroTerminal, dataHora);
						var pattern = helper.decodeBarcode(barcode);
						if(!pattern) {
							res.json({err: 1, message: 'Ocorreu um erro ao gerar o código de barras. Tente novamente.'});
							return;
						}
					}



					Configuracao.findOne({}, function(err, configuracao) {
						// console.log(1);

						// console.log(req.body);

						if(req.body.tipo === 'Diária')
							Model = require('../models/diaria');
						else
							Model = require('../models/cartao');


						



						Cartao.findOne({'carro.codigos': barcode, 'excluido.data_hora': null}, function(err, result) {

							if(!err && !result) {

								var cartao = new Model({
									_usuario: req.session.login._id,
									operador: req.session.login.nome,
									nome: '',
									codigos: [barcode],
									tipo: req.body.tipo, // 'Permanência',
									sempre_liberado: false,
									liberado: false,
									imprimir_barras: true, // entrada ONLINE pode imprimir codido de barras
									equipamento: {
										nome: '',
										numero: ''
									},
									tipo_veiculo: req.body.tipo_veiculo,
									perdido: req.body.perdido ? req.body.perdido : false,
									observacao: req.body.observacao,
									_terminal: terminal._id,
									terminal: {
										nome: terminal.nome,
										numero: terminal.numero
									},
									carro: {
										placa: req.body.carro.placa,
										marca: req.body.carro.marca ? req.body.carro.marca.toUpperCase() : '',
										modelo: req.body.carro.modelo ? req.body.carro.modelo.toUpperCase() : '',
										cor: req.body.carro.cor ? req.body.carro.cor.toUpperCase() : ''
									},
									pagamento: {
								    	tabela: {
								    		_id: '',
								    		nome: '',
								    		hora: '',
								    	},
								    	total: '',
								    	valor_recebido: '',
								    	troco: '',
										forma_pagamento: '',
										data_hora: { type: Date }
								    },
									data_cadastro: new Date(),
									data_inicio:  dataInicio,
									data_fim: null,
									ticket: {
										linha1: configuracao.ticket.linha1,
										linha2: configuracao.ticket.linha2,
										linha3: configuracao.ticket.linha3,
										linha4: configuracao.ticket.linha4,
										linha5: configuracao.ticket.linha5,
										linha6: configuracao.ticket.linha6
									}
								});

							    cartao.save(function(err, card) {
									if(!err && card) {

										self.logUsuario(req, 'create', null, cartao);

										if(req.body.tipo === 'Permanência') {
											liberacao.insereMovimentoPatio({
												_cliente: null,
												nome: 'SEM CADASTRO',
												codigo: barcode,
												tipo: req.body.tipo, //'Permanência',
												descricao: '',
												sentido: 'Entrada',
												autorizado: true,
												_terminal: terminal._id,
												terminal: {
												    nome: terminal.nome,
											    	numero: terminal.numero
												},
											});	

											if(terminal.entrada && terminal.entrada._equipamento) {
												Equipamento.findOne({_id: terminal.entrada._equipamento}, function(err, equipamento) {
													if(!err && equipamento) {
														req.io.emit('liberacao', {
															master: 0,
															operacao: 'Ação autorizada',
															mensagem_linha1: configuracao.mensagem.entrada_liberado_linha1,
		                            						mensagem_linha2: configuracao.mensagem.entrada_liberado_linha2,
															equipamento: equipamento,
															sentido: 'Entrada'
														});
													}
												});
											}

										}

										card.status = 'success';

										res.json(card);
									} else {
										console.log(err);
									}
							    });
							} else {
								res.json({err: 1, message: 'O código '+barcode+' já foi utilizado.'});
							}

						});

					}); // end Configuracao.findOne

				}

			}); // end Terminal.findOne

		//}; // fim callback

	}; // end return

}; // end create method

Controller.isUnused = function(codigo, callback){
	var Model = require('../models/cartao');
	
	Model.findOne({codigos: [codigo]}, function(err, cartao){
		callback((!err && cartao)? false : true); 
	});

}

Controller.delete = function() {
	var Model = require('../models/cartao'),
		route = this.route,
		self = this;

	return function(req, res, next) {

		if(req.params && req.params.id && req.body && req.body.observacao) {
			if(!req.body.senha || req.body.senha !== req.session.login.senha) {
				console.log('req.session.login.senhal: '+req.session.login.senha);
				res.json({err: 1, message: 'Senha inválida'});
			} else {

				var update = {
					'excluido': {
						data_hora: new Date(),
						_usuario: req.session.login._id,
						usuario: req.session.login.nome,
						observacao: req.body.observacao
					}
				};

				Model.findOne({_id: req.params.id}, function(err, oldDocument) {
					if(err || !oldDocument)
						res.json({err: 1, message: 'Não foi possível realizar a operação.<br />Registro não encontrado.'});
					else
						Model.findOneAndUpdate({ _id: req.params.id }, update, function(err, newDocument) {
							if(err || !newDocument)
								res.json({err: 1, message: 'Não foi possível realizar a operação.'});
							else {
								self.logUsuario(req, 'delete', oldDocument, newDocument);
								
								if(req.body.redirect && req.body.redirect === 'true') {
									// req.flash('success','Operação realizada com sucesso.');
									res.json({err: 0, redirect: '/'+route});
								} else
									res.json({err: 0, message: ''});
							}
						});
				});
			}
		} else
			res.json({err: 1, message: 'Registro não encontrado ou motivo não informado, não foi possível realizar a operação.'});
	};
};

// expose this inherited controller
module.exports = Controller;
