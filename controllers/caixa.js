'use strict';

var controller = require('../controllers/controller'),
	notaFiscal = require('../controllers/nota-fiscal'),
	gerenciador = require('../controllers/gerenciador-de-tabela'),
	moment = require('moment'),
	helper = require('../config/helper'),
	config = require('../config'),
	request = require('request'),
	async = require('async'),
	mongoose = require('mongoose'),
	fetch = require('node-fetch');

var Cartao = require('../models/cartao'),
	Caixa = require('../models/caixa'),
	Terminal = require('../models/terminal'),
	Cliente = require('../models/cliente'),
	Diaria = require('../models/diaria'),
	Configuracao = require('../models/configuracao'),
	TabelaDePreco = require('../models/tabela-preco'),
	Equipamento = require('../models/equipamento'),
	Usuario = require('../models/usuario'),
	GerenciadorDeTabelas = require('../models/gerenciador-de-tabela'),
	Pagamento = require('../models/pagamento'),
	PagamentoEmMassa	= require('../models/pagamento-em-massa');

// creating a new controller object
var Controller = new controller({
	route: 'caixa',
	menu: '',
	pageName: 'Caixa',
	pageNamePlural: 'Caixa',
	model: 'caixa'
});

Controller.customRoutes = function (app) {

	app.get('/' + this.route + '/printPagamentoPrePago/:id', this.autentication(), this.default(), this.printPagamentoPrePago())

		.get('/' + this.route + '/printPagamentoMensalista/:id', this.autentication(), this.default(), this.printPagamentoMensalista())

		.get('/' + this.route + '/printPagamentoDiaria/:id', this.autentication(), this.default(), this.printPagamentoDiaria())

		.post('/' + this.route + '/findClient', this.autentication(), this.permission('read'), this.validation('findClient'), this.findClient())

	   .post('/'+this.route+'/find', this.autentication(), this.permission('read'), this.validation('find'), this.find())
	   
	   .post('/'+this.route+'/pagamento-em-massa/:id', this.autentication(), this.permission('read'), this.pagarEmMassa())

		.post('/' + this.route + '/pagamento-em-massa/:id', this.autentication(), this.permission('read'), this.pagarEmMassa())

		.put('/' + this.route + '/checkout/:id', this.autentication(), this.permission('read'), this.validation('checkout'), this.checkout())

		.put('/' + this.route + '/confirmPayment/:id', this.autentication(), this.permission('read'), this.validation('confirmPayment'), this.confirmPayment())

		.put('/' + this.route + '/comprarDiaria/:id', this.autentication(), this.permission('read'), this.validation('comprarDiaria'), this.comprarDiaria())

		.put('/' + this.route + '/pagarMensalidade/:id', this.autentication(), this.permission('read'), this.validation('pagarMensalidade'), this.pagarMensalidade())

		.put('/' + this.route + '/buyCredit/:id', this.autentication(), this.permission('read'), this.validation('buyCredit'), this.buyCredit());
};

Controller.validation = function (resource) {

	return function (req, res, next) {
		console.log('validation +' + resource);

		if (resource === 'print')
			next();

		if (!req.session.terminal || req.session.terminal.tipo.indexOf('Caixa') === -1) {
			return res.json({ err: 1, status: 'error', message: 'Nenhum terminal tipo Caixa com IP ' + req.session.ip + ' encontrado.' });
		} else {
			switch (resource) {
				case 'create':
					var valor_inicio = 0;

					if (req.body.valor_inicio) {
						valor_inicio = req.body.valor_inicio;
						valor_inicio = valor_inicio.replace('.', '');
						valor_inicio = valor_inicio.replace(',', '.');
					}

					if (isNaN(valor_inicio))
						res.json({ err: 1, message: 'Saldo inicial inválido.' });
					else if (!req.body.senha)
						res.json({ err: 1, message: 'Por favor preencha os campos obrigatórios.' });
					else if (req.body.senha !== req.session.login.senha)
						res.json({ err: 1, message: 'Senha inválida.' });
					else {
						if (req.session.caixa)
							res.json({ err: 1, message: 'Você já tem um caixa aberto.' });
						else
							next();
					}
					break;
				case 'checkout':
					var valor_fim = 0;

					if (req.body.valor_fim) {
						valor_fim = req.body.valor_fim;
						valor_fim = valor_fim.replace('.', '');
						valor_fim = valor_fim.replace(',', '.');
					}

					if (isNaN(valor_fim))
						res.json({ err: 1, message: 'Saldo final inválido.' });
					else if (req.body.senha !== req.session.login.senha)
						res.json({ err: 1, message: 'Senha inválida.' });
					else if (!req.body.valor_fim || !req.body.senha)
						res.json({ err: 1, message: 'Por favor preencha os campos obrigatórios.' });
					else if (!req.session.caixa)
						res.json({ err: 1, message: 'Você não tem um caixa aberto.' });
					else
						next();
					break;
				case 'find':
					if(!req.session.caixa && !req.session.equipamento)
						res.json({err: 1, message: 'Você precisa abrir o caixa primeiro.'});
					else
						next();
					break;
				case 'confirmPayment':
					if (!req.body.code || !req.body.permanencia || !req.body.pagamento || !req.body.pagamento.tabela || !req.body.pagamento.tabela._id || !req.body.pagamento.forma_pagamento || !req.body.pagamento.total || !req.body.limite_saida)
						res.json({ err: 1, message: 'Dados inválidos.' });
					else if (!req.session.caixa)
						res.json({ err: 1, message: 'Você precisa abrir o caixa primeiro.' });
					else
						next();
					break;
				case 'comprarDiaria':
					if (!req.session.caixa)
						res.json({ err: 1, message: 'Você precisa abrir o caixa primeiro.' });
					else
						next();
					break;
				case 'pagarMensalidade':
					if (!req.session.caixa)
						res.json({ err: 1, message: 'Você precisa abrir o caixa primeiro.' });
					else
						next();
					break;
				case 'buyCredit':
					if (!req.body.pagamento || !req.body.pagamento.valor || !req.body.pagamento.forma_pagamento || !req.body.code)
						res.json({ err: 1, status: 'error', message: 'Por favor, preencha todos os campos obrigatórios' });
					else if (!req.session.caixa)
						res.json({ err: 1, message: 'Você precisa abrir o caixa primeiro.' });
					else
						next();
					break;
				default:
					next();
					break;
			}

		}
	};
};

Controller.geraRelatorio = function (req, res, next) {
	var options = req.options;
	options.relatorioPagamento = [];
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

	TabelaDePreco.find({ ativo: true }, null, { sort: { nome: 1 } }).exec(function (err, tabelaDePreco) {
		if (!err && tabelaDePreco) {
			for (var i = 0; i < tabelaDePreco.length; i++) {
				options.tabela_de_preco[tabelaDePreco[i]._id] = {
					nome: tabelaDePreco[i].nome,
					total: 0,
					quantidade: 0
				};
			}

			Caixa.findOne({ _id: req.params.id }, function (err, caixa) { // recupera todos os caixas do periodo
				options.caixa = caixa;

				Pagamento.find({ _caixa: req.params.id }, function (err, relatorioPagamento) {
					if (relatorioPagamento && !err) {

						async.forEachOf(relatorioPagamento, function (pagamento, index, callback) {

							if (pagamento.valor && options.tipo_cliente && options.tipo_cliente[pagamento.tipo]) {

								if (options.forma_pagamento[pagamento.forma_pagamento]) {
									options.forma_pagamento[pagamento.forma_pagamento].total += helper.moeda2float(pagamento.valor);
									options.forma_pagamento[pagamento.forma_pagamento].quantidade++;
								}

								if (options.tipo_cliente[pagamento.tipo]) {
									options.tipo_cliente[pagamento.tipo].total += helper.moeda2float(pagamento.valor);
									options.tipo_cliente[pagamento.tipo].quantidade++;
								}

								if (pagamento.tabela && pagamento.tabela._id) {
									if (options.tabela_de_preco[pagamento.tabela._id]) {
										options.tabela_de_preco[pagamento.tabela._id].total += helper.moeda2float(pagamento.valor);
										options.tabela_de_preco[pagamento.tabela._id].quantidade++;
									} else {
										options.tabela_de_preco[pagamento.tabela._id] = {
											nome: pagamento.tabela.nome,
											total: helper.moeda2float(pagamento.valor),
											quantidade: 1
										}
									}
								}

							}

							callback();

						}, function (err) {
							res.render(options.route, options);
						});




					} else
						res.render(options.route, options);

				});

			});
		}
	}); // tabelaDePreco
};

Controller.print = function () {
	var self = this;

	return function (req, res, next) {
		req.options.route = self.route + '/print';
		req.options.layout = 'print';

		if (req.query.printComPopup)
			req.options.printComPopup = true;

		self.geraRelatorio(req, res, next);
	};
};

Controller.printPagamentoDiaria = function () {
	var self = this;

	return function (req, res, next) {
		req.options.layout = 'print';

		Diaria.findOne({ '_id': req.params.id }, function (err, result) {
			if (!err && result) {
				req.options.result = result;
				res.render(self.route + '/printPagamentoDiaria', req.options);
			}
		});
	};
};

Controller.printPagamentoPrePago = function () {
	var self = this;

	return function (req, res, next) {
		req.options.layout = 'print';

		Pagamento.findOne({ '_id': req.params.id }).populate(['_cliente', '_caixa']).exec(function (err, pagamento) {
			if (!err && pagamento) {
				req.options.pagamento = pagamento;
					res.render(self.route + '/printPagamentoPrePago', req.options);
				
			}
		});

	};
};

Controller.printPagamentoMensalista = function () {
	var Model = require('../models/caixa'),
		self = this;

	return function (req, res, next) {
		req.options.layout = 'print';
		Pagamento.findOne({ '_id': req.params.id }).populate('_caixa').populate('_cliente').exec(function (err, pagamento) {
			if (!err && pagamento) {
				req.options.pagamento = pagamento;
				res.render(self.route + '/printPagamentoMensalista', req.options);
			}
		});
	};
};

Controller.create = function () {
	var Model = require('../models/caixa'),
		route = this.route;

	return function (req, res, next) {
		req.body._usuario = req.session.login._id;
		req.body.usuario = req.session.login.nome;
		req.body.saldo = req.body.valor_inicio || '0,00';
		req.body.pagamento = {};

		var data = new Model(req.body);
		data.save(function (err, caixa) {
			if (err || !caixa) {
				res.json({ err: 1, message: 'Não foi possível abrir o caixa.' });
			} else {
				//req.flash('success','Caixa aberto com sucesso.');
				req.session.caixa = caixa;
				res.json({ err: 0, redirect: '/' + route + '/' + caixa._id });
			}
		});
	};
};

Controller.checkout = function () {
	var Model = require('../models/caixa'),
		self = this;

	return function (req, res, next) {
		var alteracoes = {};
		alteracoes.finalizado = true;
		alteracoes.data_fim = Date.now();
		alteracoes.valor_fim = req.body.valor_fim;

		Model.findOneAndUpdate({ '_id': req.params.id, '_usuario': req.session.login._id, finalizado: false }, { $set: alteracoes }, { multi: false }, function (err, caixa) {
			if (err || !caixa) {
				res.json({ err: 1, message: 'Não foi possível fechar o caixa.' });
			} else {
				req.session.caixa = null;

				var printUrl = '/' + self.route + '/print/' + caixa._id;

				req.flash('success', 'Seu caixa foi fechado com sucesso.<br /><a href="' + printUrl + '" class="print">Reimprimir Relátorio de Fechamento de Caixa.</a>');
				res.json({
					err: 0,
					print: printUrl + '?printComPopup=true',
					redirect: '/inicio'
				});
			}
		});
	};
};

Controller.edit = function () {
	var self = this;

	return function (req, res, next) {
		req.options.isEdit = true;
		req.options.action = '';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb.push({
			route: '/' + self.route + '/' + req.params.id,
			pageName: req.options.title
		});

		req.options.layout = 'basic';

		Caixa.findOne({ _usuario: req.session.login._id, _id: req.params.id, finalizado: false }, function (err, result) {
			req.options.caixa = result; // pega o caixa atual

			TabelaDePreco.find({ ativo: true }, function (err, result) {
				if (!err && result)
					req.options.priceTables = result;

				GerenciadorDeTabelas.find({ ativo: true }, function(err, result){
					(!err && result)
						req.options.gerenciadores = result;

					Usuario.find({}, function (err, result) {
						if (!err && result)
							req.options.usuarios = result;
	
						res.render(self.route + '/show', req.options);
					});
				});

			});
		});
	};
};

Controller.pagarEmMassa = function () {
	var self				= this,
		Ticket				= require('../controllers/ticket');


	//teste da branch gerenciador_de_tabelas para ver se está independente
	return function (req, res, next) {
		var ip					= req.session.ip;
		var terminal			= req.session.terminal;
		var configuracao		= req.session.configuracao;
		var pagamentoEmMassa	= new PagamentoEmMassa({
			cadastro: new Date(),
			'_tabela-de-preco': {},
			valor: helper.float2moeda(Number(req.body['preco-unitario'])),
			quantidade: Number(req.body['quantidade-cartao']),
			total: helper.float2moeda(Number(req.body['preco-unitario']) * Number(req.body['quantidade-cartao'])),
			forma_pagamento: req.body.forma_pagamento,
			_usuario: req.session.login._id,
			nome_usuario: req.session.login.nome,
			_caixa: req.params.id,
			_terminal: req.session.terminal._id,
			ip: ip,
			_pagamentos:[]
		});
		if(pagamentoEmMassa.quantidade > 300 || pagamentoEmMassa.quantidade <= 0)
			return res.json({ err: 1, message: 'A quantidade de tickets deve ser entre 1 e 300.' });

		TabelaDePreco.findOne({ _id: req.body.tabela }, function (err, tabela) {
			if (!err && tabela) {
				pagamentoEmMassa['_tabela-de-preco']._id = tabela._id;
				pagamentoEmMassa['_tabela-de-preco'].nome = tabela.nome;
				async.times(Number(req.body['quantidade-cartao']), function (valor, callback) {
					
					function generateBarcode(callback) {
						var barcode = helper.generateBarcodeRandom(12);

						Ticket.isUnused(barcode, function (res) {
							if (res === false)
								generateBarcode(callback);
							else {
								new Cartao({
									_usuario: req.session.login._id,
									operador: req.session.login.nome,
									nome: '',
									codigos: [barcode],
									tipo: "Permanência",
									sempre_liberado: false,
									liberado: false,
									imprimir_barras: true,
									equipamento: {
										nome: '',
										numero: ''
									},
									tipo_veiculo: "CARRO",
									_terminal: terminal._id,
									terminal: {
										nome: terminal.nome,
										numero: terminal.numero
									},
									data_cadastro: new Date(),
									data_inicio: new Date(),
									data_fim: new Date(),
									ticket: {
										linha1: configuracao.ticket.linha1,
										linha2: configuracao.ticket.linha2,
										linha3: configuracao.ticket.linha3,
										linha4: configuracao.ticket.linha4,
										linha5: configuracao.ticket.linha5,
										linha6: configuracao.ticket.linha6
									}
								}).save(function (err, ticket) {
									if (!err, ticket) {
										new Pagamento({
											_id: new mongoose.Types.ObjectId(),
											_caixa: req.params.id,
											_cartao: ticket._id,
											// _equipamento: terminal._id,
											_usuario: req.session.login._id,
											operador: req.session.login.nome,
											forma_pagamento: req.body.forma_pagamento,
											valor: helper.float2moeda(Number(req.body['preco-unitario'])),
											valor_recebido: helper.float2moeda(Number(req.body['preco-unitario'])),
											troco: '0,00',
											nome: 'Pagamento de Ticket',
											tipo: 'Permanência',
											pago: true,
											data_vencimento: new Date(),
											data_registro: new Date(),
											data_pagamento: new Date(),
											tabela: {
												_id: tabela._id,
												nome: tabela.nome
											}
										}).save(function (err, pagamento) {
											if (!err && pagamento) {
												ticket.pagamento.push(pagamento);

												Cartao.findOneAndUpdate({ _id: pagamento._cartao }, ticket, { upsert: false }, function (err) {
													if (!err){
														pagamentoEmMassa._pagamentos.push(pagamento._id);
														if(pagamentoEmMassa._pagamentos.length == req.body['quantidade-cartao']){
															pagamentoEmMassa.save(function (err, result){
																if(!err && result)
																	callback();
															});	
														}else
															callback();
													}
													else
														console.log('Deu ruim xD');
												});
											} else {
												console.log('Pagamento não foi gerado!');
												console.log(err);
											}
										});

									} else {
										console.error('FALHA AO SALVAR O TICKET, TENTANDO NOVAMENTE');
										generateBarcode(callback);
									}
								});
							}
						});
					}

					generateBarcode(callback);
				}, function (err) {
					Caixa.findById(req.params.id, function (err, caixa) {
						if (!err && caixa) {

							var valorProcessado = Number(req.body['quantidade-cartao']) * Number(req.body['preco-unitario']),
								permanenciaAtual = helper.moeda2float(caixa.categoria['Permanência'].total),
								formaPagamentoAtual = helper.moeda2float(caixa.forma_pagamento[req.body.forma_pagamento].total),
								valorEntrada = helper.moeda2float(caixa.valor_entrada),
								valorSaldo = helper.moeda2float(caixa.saldo);

							caixa.valor_entrada = helper.float2moeda(valorEntrada + valorProcessado);

							caixa.saldo = helper.float2moeda(valorSaldo + valorProcessado);

							caixa.categoria['Permanência'].total = helper.float2moeda(permanenciaAtual + valorProcessado);
							caixa.categoria['Permanência'].quantidade += Number(req.body['quantidade-cartao']);

							caixa.forma_pagamento[req.body.forma_pagamento].total = helper.float2moeda(formaPagamentoAtual + valorProcessado);
							caixa.forma_pagamento[req.body.forma_pagamento].quantidade += Number(req.body['quantidade-cartao']);

							Caixa.findOneAndUpdate({ _id: req.params.id }, caixa, { upsert: false }, function (err) {
								if (!err) {
									res.json({ err: 0, message: 'Pagamento em massa realizado com sucesso.', caixa: caixa, pgtomassa: pagamentoEmMassa, data_formatada: helper.formataData(pagamentoEmMassa.cadastro) });
								} else {
									console.log('não atualizou');
									console.log(err);
									res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.' });
								}
							});
						} else {
							res.json({ err: 1, message: 'Caixa não encontrado.' });
						}
					});
				});



			} else {
				res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.' });
			}
		});
	};
};

Controller.calculaPermanencia = function (permanencia, permanencias) {
	// permanencia = permanencia do cliente
	// permanencias = lista de permanencias da tabela de preços

	var result = {
		erro: true,
		hora: '00:00',
		valor: '0'
	};

	if (permanencia && permanencias) {
		permanencia = Math.floor(moment.duration(permanencia).asMinutes());

		for (var i = 0; i <= permanencias.length - 1; i++) {
			if (permanencias[i].hora && permanencias[i].valor && permanencias[i].hora !== '00:00') {

				result.valor = helper.moeda2float(permanencias[i].valor);
				result.hora = permanencias[i].hora;

				if (Math.floor(moment.duration(permanencias[i].hora).asMinutes()) >= permanencia) {
					result.erro = false;
					break;
				}
			}
		}
	}

	//console.log(result);

	return result;
};

Controller.calculaDiaria = function (quantidade_dia, dias) {
	// quantidade_dia = quantidade_dia do cliente
	// dias = lista de dias da tabela de preços

	var result = {
		erro: true,
		quantidade: 1,
		valor: '0'
	};

	if (quantidade_dia && dias) {

		for (var i = 0; i <= dias.length - 1; i++) {
			if (dias[i].quantidade && dias[i].valor && dias[i].quantidade !== 0 && dias[i].quantidade !== '0') {

				quantidade_dia = Number(quantidade_dia);
				dias[i].quantidade = Number(dias[i].quantidade);

				// console.log('Procurando uma faixa de preco de diaria')

				result.quantidade = dias[i].quantidade;
				result.valor = helper.moeda2float(dias[i].valor);

				// console.log(' => '+result.quantidade + ' dia(s) por '+result.valor)

				if (dias[i].quantidade >= quantidade_dia) {
					console.log('faixa de preço encontrada! fim do calculo de valor cobrado para o cliente');
					result.erro = false;
					break;
				}
			}
		}
	}

	//console.log(result);

	return result;
};

Controller.calculaTotalDiaria = function (quantidade_dia, tabela) {
	var result = {};

	if (quantidade_dia && tabela) {
		result = this.calculaDiaria(quantidade_dia, tabela.dias);

		if (result.erro) {

			// console.log('A quantidade de diárias do cliente é superior a cadastrada na tabela de preços');

			var quantidadeNaoCobrada = quantidade_dia - result.quantidade;

			if (tabela.xxx === 'preço fixo' && tabela.preco_fixo && tabela.preco_fixo.dia && tabela.preco_fixo.valor) {
				// console.log('Será utilizado o preço fixo para '+quantidadeNaoCobrada+' dia(s) ainda não cobrado(s)');

				tabela.preco_fixo.valor = helper.moeda2float(tabela.preco_fixo.valor);
				tabela.preco_fixo.dia = Number(tabela.preco_fixo.dia);

				var multiplicador = Math.ceil(quantidadeNaoCobrada / tabela.preco_fixo.dia);

				var valorPrecoFixo = tabela.preco_fixo.valor * multiplicador;

				// console.log('Adicionando ao total '+valorPrecoFixo+' referente ao preço fixo de '+tabela.preco_fixo.valor+' a cada '+tabela.preco_fixo.dia+ ' dia(s)');

				// console.log(' => '+result.quantidade+' dias = '+result.valor+' + '+quantidadeNaoCobrada+' dias = '+valorPrecoFixo + ' = '+result.valor+valorPrecoFixo);

				result.valor += valorPrecoFixo;
				result.quantidade += quantidadeNaoCobrada;
				result.erro = false;

			} else if (tabela.xxx === 'reiniciar tabela' && tabela.dias) {
				// console.log('Será utilizado o reiniciar tabela para '+quantidadeNaoCobrada+' dia(s) ainda não cobrado(s)');

				var acumuladorValor = result.valor;
				var acumuladorQuantidade = result.quantidade;
				var numeroDeRepeticoes = 0;
				var valorInicial = result.valor;

				while (result.erro) {
					result = this.calculaDiaria(quantidadeNaoCobrada, tabela.dias);

					quantidadeNaoCobrada -= result.quantidade;

					acumuladorValor += result.valor;
					acumuladorQuantidade += result.quantidade;

					numeroDeRepeticoes++;
				}

				// console.log('Adicionando '+(acumuladorValor-valorInicial)+' referente a '+numeroDeRepeticoes+' reinicios de tabela de preço, total '+acumuladorValor);

				result.valor = acumuladorValor;
				result.quantidade = acumuladorQuantidade;

				result.erro = false;
			}
		}


		result.valor = helper.float2moeda(result.valor);

		return result;
	}
};

Controller.calculaPrecoTabela = function (permanencia, tabela) {
	// permanencia = permanencia do cliente
	// tabela = tabela de preços relacionada ao ticket do cliente
	// result = permanencia da lista de permanencias da tabela
	var result = {},
		permanenciaNaoCobrada = '00:00';


	if (permanencia && tabela) {

		result = this.calculaPermanencia(permanencia, tabela.permanencias);

		// se result.erro = true então a permanencia do cliente é superior a todas as permanencia da tabela de preço
		if (result.erro) {

			if (tabela.xxx === 'preço fixo' && tabela.preco_fixo && tabela.preco_fixo.hora && tabela.preco_fixo.valor) {
				// console.log('***tabela tem preço fixo');


				permanenciaNaoCobrada = helper.diferencaHora(permanencia, result.hora);

				// console.log('\npermanencia: '+permanencia+ ' / hora n cobrada: '+result.hora + ' / permanenciaNaoCobrada: '+permanenciaNaoCobrada);


				var minutoNaoCobrado = moment.duration(permanenciaNaoCobrada).asMinutes();
				var minutoPrecoFixo = moment.duration(tabela.preco_fixo.hora).asMinutes();

				// console.log('\nminutoNaoCobrado: '+minutoNaoCobrado);

				tabela.preco_fixo.valor = helper.moeda2float(tabela.preco_fixo.valor);

				// console.log('\ntabela.preco_fixo.valor: '+tabela.preco_fixo.valor);

				// se o minuto que ainda nao foi cobrado for menor que o preco fixo cobra somente uma vez esse preco fixo
				var multiplicador = Math.ceil(minutoNaoCobrado / minutoPrecoFixo);

				result.valor += tabela.preco_fixo.valor * multiplicador;

				var minutoPrecoFixoTotal = minutoPrecoFixo * multiplicador;
				var minutoResultHora = moment.duration(result.hora).asMinutes();

				var sum = minutoPrecoFixoTotal + minutoResultHora;
				var hours = Math.floor(sum / 60);
				var minutes = sum % 60;

				result.hora = hours + ':' + minutes;

				result.erro = false;

				// console.log(result);

			} else if (tabela.xxx === 'reiniciar tabela' && tabela.permanencias) {
				// console.log('tabela tem reiniciar tabela');
				// vao servir de acumuladores para dar o result final
				var valor = result.valor;
				var hora = result.hora;

				permanenciaNaoCobrada = helper.diferencaHora(permanencia, result.hora);

				while (result.erro) {
					result = this.calculaPermanencia(permanenciaNaoCobrada, tabela.permanencias);

					permanenciaNaoCobrada = helper.diferencaHora(permanenciaNaoCobrada, result.hora);

					valor += result.valor;
					hora = helper.somaHora(hora, result.hora);
				}

				result.valor = valor;
				result.hora = hora;

			}


		}

		/// verificacoes aqui
		// se valor isNaN
		// se data is valide date

	}

	if (result.valor)
		result.valor = helper.float2moeda(result.valor);

	if (result.hora)
		result.hora = helper.formataHora(result.hora);

	return result;
};

Controller.showDiaria = function (diaria, params, callback) {
	var self = this;

	// console.log('Entrou no bloco de Diária');

	diaria = diaria.toObject();

	// falta verificar se está dentro da permanencia pra exibir a mensagem

	//console.log(params);

	diaria.temPagamentoValido = false;
	if (diaria.pagamento && diaria.pagamento.length > 0)
		diaria.temPagamentoValido = true;

	// console.log('diaria tem pagamento: '+diaria.temPagamentoValido);



	if (diaria.temPagamentoValido) {
		diaria.data_validade_inicio = moment(diaria.data_validade_inicio).format('DD/MM/YYYY');
	} else {
		if (params && params.data_validade_inicio)
			diaria.data_validade_inicio = params.data_validade_inicio;
		else
			diaria.data_validade_inicio = moment().format('DD/MM/YYYY');
	}

	if (diaria.temPagamentoValido)
		diaria.quantidade_dia_minimo = diaria.quantidade_dia;
	else
		diaria.quantidade_dia_minimo = 1;



	if (diaria.temPagamentoValido === false && diaria.data_validade_inicio === helper.separaData(new Date()))
		diaria.exibeSituacao = true;
	else
		diaria.exibeSituacao = false;


	// lembrar de quando deletar um pagamento alterar o quantidade_dia



	if (diaria.temPagamentoValido) {
		diaria.message = 'Este ticket já foi pago.';

		// se ela ja tem pagamento tu so pode alterar a quantidade de diar se for maior ao que ja tem na diaria
		if (params && params.quantidade_dia && params.quantidade_dia > diaria.quantidade_dia) {
			diaria.quantidade_dia = params.quantidade_dia;
			diaria.confirmarPagamento = true;
			diaria.message = '';
		} else
			diaria.confirmarPagamento = false;
	} else {
		if (params.quantidade_dia)
			diaria.quantidade_dia = params.quantidade_dia;
		else
			diaria.quantidade_dia = 1;

		diaria.confirmarPagamento = true;
	}













	diaria.data_validade_fim = helper.adicionaDias(diaria.data_validade_inicio, diaria.quantidade_dia - 1);




	// calcular total aqui
	var filter = {};

	filter.ativo = true;
	filter.tipo = 'Diária';

	if (params && params.id_tabela)
		filter._id = params.id_tabela;
	else {
		if (diaria.temPagamentoValido && diaria.pagamento[diaria.pagamento.length - 1] && diaria.pagamento[diaria.pagamento.length - 1].tabela._id) {
			filter._id = diaria.pagamento[diaria.pagamento.length - 1].tabela._id;
		} else
			filter.padrao = true;
	}

	diaria.err = true;
	diaria.status = 'error';

	// verifica se o horario para saida é menor ou igual
	TabelaDePreco.findOne(filter).exec(function (err, priceTable) {
		if (typeof priceTable !== 'undefined' && priceTable && !err) {

			var result = self.calculaTotalDiaria(diaria.quantidade_dia, priceTable);
			if (typeof result === 'object') {

				if (result.erro) {
					diaria.err = true;
					diaria.status = 'error';
				} else {

					// manda o ID da tabela utilizada para a funcao showCartao marcar a tabela utilizada no select do caixa
					diaria.id_tabela = priceTable._id;
					diaria.nome_tabela = priceTable.nome;

					// o total foi calculado novamente e retirado o valor que o cliente ja pagou
					var totalPago = 0;
					if (diaria.temPagamentoValido && diaria.pagamento) {
						for (var i = diaria.pagamento.length - 1; i >= 0; i--) {

							var pagamento = diaria.pagamento[i];

							//console.log(pagamento);
							if (!pagamento.excluido || pagamento.excluido.data_hora === null) {
								// console.log('pagamento.valor '+pagamento.valor);
								totalPago += Number(helper.moeda2float(pagamento.valor));
							}

						}
					}

					// console.log('total de pagamentos já efetuados: '+totalPago);

					diaria.total = helper.moeda2float(result.valor) - totalPago;
					diaria.total = helper.float2moeda(diaria.total);


					// console.log('total a pagar: '+diaria.total);

					diaria.err = false;
					diaria.status = 'success';
				}

			}
		} else {
			diaria.err = true;
			diaria.status = 'error';

			if (params && params.id_tabela)
				diaria.message = 'A tabela de preço selecionada não foi encontrada.';
			else
				diaria.message = 'A tabela de preço padrão com cobrança por diária não foi encontrada.';
		}

		callback(diaria.err, diaria);
	});
}

Controller.find = function () {
	var options = config.app(),
		self = this;

	return function (req, res, next) {
		Configuracao.findOne({}, function (err, config) {
			if (!err && config) {
				// console.log('====================================================================================================');

				console.log('IMPRIMINDO QUERY');
				console.log(req.query);
				console.log('IMPRIMINDO PARAMS');
				console.log(req.params);
				console.log('IMPRIMINDO BODY');
				console.log(req.body);

				var barcode = req.body.code;
				var barcode2 = barcode.slice(0, 3) + '-' + barcode.slice(3);

				options.permission = req.permission;

				// console.log('Controller.find');

				Diaria.findOne({
					$or: [
						{ codigos: barcode },
						{ 'carro.placa': barcode },
						{ 'carro.placa': barcode2 }
					],
					'excluido.data_hora': null
					// data validade fim <= data atual // adicionar tambem no find
				}, null,
					{
						sort: {} // data_fim
					}, function (err, diaria) {

						if (!err && diaria) {

							self.showDiaria(diaria, req.body, function (err, diaria) {
								// console.log('++++++ result ++++++');
								// console.log(diaria);
								res.json(diaria);
							});


						} else {

							// process.exit(1);

							Cartao.findOne({
								$or: [
									{ codigos: barcode },
									{ 'carro.placa': barcode },
									{ 'carro.placa': barcode2 }
								],
								'excluido.data_hora': null
							}, null,
								{
									sort: { liberado: 1 } // data_fim
								}, function (err, card) {
									
									if (card)
										card = card.toObject();
									else {
										var pattern = helper.decodeBarcode(barcode);
										if (pattern) {

											if (config.app.entrada_offline === false) {
												res.json({ err: 1, message: 'Entrada offline desabilitada.' });
												return false;
											}

											card = {
												_id: new mongoose.Types.ObjectId(),
												tipo: 'Permanência',
												nome: barcode,
												sempre_liberado: false,
												liberado: false,
												data_inicio: moment(pattern.dia + '/' + pattern.mes + '/' + pattern.ano + ' ' + pattern.hora + ':' + pattern.minuto, 'DD/MM/YYYY HH:mm').toISOString(),
												codigos: [barcode]
											};
										}
									}

									if (card) {

										// se tem data_fim então esse ticket já saiu
										if (card.data_fim) {
											card.liberado = true; // liberado exibe o bloco bloqueado -.-
										} else {

											var pagarNovamente = false;
											var valorPago = 0;
											if (card.limite_saida && card.pagamento.length) {
												//quando o ticket já foi pago mas já excedeu o limite para saida, ele pode ser pago novamente na diferença
												var timeStampLimiteSaida = moment(card.limite_saida).valueOf();
												var timeStampDataHoraAtual = moment(moment()).valueOf();
												if (timeStampDataHoraAtual > timeStampLimiteSaida) {
													card.liberado = false;
													pagarNovamente = true;

													card.message = 'Ticket excedeu o limite para saída.';

													for (var i = card.pagamento.length - 1; i >= 0; i--) {
														valorPago += helper.moeda2float(card.pagamento[i].valor);
													}
													
													valorPago = helper.float2moeda(valorPago);
												}
											}

										}

										if (card.data_inicio)
											card.data_inicio = moment(card.data_inicio).format('DD/MM/YYYY HH:mm');

										if (card.data_fim)
											card.data_fim = moment(card.data_fim).format('DD/MM/YYYY HH:mm');

										if (card.limite_saida)
											card.limite_saida = moment(card.limite_saida).format('DD/MM/YYYY HH:mm');


										if (card.liberado) {
											card.err = false;
											card.message = 'Este ticket já foi pago.';

											if (card.tolerancia)
												card.message = 'Ticket saiu na tolerância.';

											if (card.permanencia)
												card.permanencia = helper.formataHora(card.permanencia);

											card.status = 'success';
											res.json(card);
										} else { // bloqueado


										if(card.convenio){
											card.message = 'Ticket vinculado à convênio.'
										}

											// calcula o tempo de permanencia (diferença entre a data atual e a data_inicio)
											// É por aqui que deve-se implementar o algorítimo do gerenciador de tabelas 0.0
											var pagamento = {
												tabela: {},
											};

											console.log('executou a funcao fidtable');
											console.log(card.convenio);
											
											// trabalhando com o gerenciador de tabelas
											// caso um gerenciador seja selecionado é considerado a busca pelo gerenciador
											gerenciador.findTable(new Date(), (card.convenio && card.convenio._gerenciador) ? card.convenio._gerenciador : req.body.id_gerenciador, card, function (result) {
												if (!result) {
													res.json({ err: 1, message: 'Não foi possível gerar informações' });
												} else {
													
													var filter = {
														tipo: 'Permanência'
													};
													var hora_inicial;
		
													if (typeof req.body.id_tabela !== 'undefined' && typeof req.body.id_gerenciador === 'undefined' && !card.convenio) {
														console.log('tabela selecionada');
														filter._id = req.body.id_tabela;
													} else if (card.convenio && card.convenio._tabelapreco) {
														filter._id = card.convenio._tabelapreco;
														console.log('tabela pelo convenio');
													} else if(result && result.tabela !== 'usar-tabela-padrão'){
														console.log('gerenciador selecionado');
														filter._id = result.tabela;
														if(result['horario-cobrado'])
															hora_inicial = result['horario-cobrado'];
														
														if(result.gerenciador && typeof result.gerenciador !== 'undefined'){
															pagamento['gerenciador-de-tabela'] = {};
															pagamento['gerenciador-de-tabela']._id = result.gerenciador._id;
															pagamento['gerenciador-de-tabela'].nome = result.gerenciador.nome;
															pagamento['gerenciador-de-tabela'].hora = moment().format('dd/MM/YYYY hh:mm');
														}
													}else{
														console.log('tabela padrão');
														filter.padrao = true;
														filter.ativo = true;
													}

													TabelaDePreco.findOne(filter).exec(function (err, priceTable) {
														if (typeof priceTable !== 'undefined' && priceTable && !err) {
															console.log('TABELA DE PREÇO')
															console.log('')
															console.log(priceTable)
															
															card.permanencia	=	helper.diferencaData(moment(), card.data_inicio);
															var permanencia		=	helper.diferencaData(moment(), (hora_inicial && (!card.convenio || (card.convenio && card.convenio._gerenciador))) ? hora_inicial : card.data_inicio);
															// adiciona o valor a ser vendido com a opcao Vender Horas
															if (req.body.addHour) {
																permanencia = helper.somaHora(permanencia, req.body.addHour);
																card.permanencia = helper.somaHora(card.permanencia, req.body.addHour);
																card.addHourDEBUG = helper.formataHora(req.body.addHour);
															}

															card.permanenciaDEBUG = helper.formataHora(card.permanencia);

															// verifica se esta dentro da tolerancia de entrada
															var timeStampPermanencia = moment(card.permanencia, 'HH:mm').valueOf();
															var timeStampTolerancia = moment(priceTable.tolerancia_entrada, 'HH:mm').valueOf();

															if (timeStampPermanencia < timeStampTolerancia && priceTable.tolerancia_entrada !== '00:00' && priceTable.tolerancia_entrada !== 'undefined') {
																var tempoRestanteSaida = helper.diferencaHora(priceTable.tolerancia_entrada, card.permanencia);
																card.tolerancia = true;
																// falta exibir quanto tempo para saida
																// no checkout exibir os pagamentos
																card.message = 'Ticket dentro do periodo de tolerância, restam <b>' + tempoRestanteSaida + '</b> para saída.';
																card.err = false;
															} else

																if (priceTable && !card.tolerancia) {
																	var result = self.calculaPrecoTabela(permanencia, priceTable);
																	var resultForHourReal = self.calculaPrecoTabela(card.permanencia, priceTable);

																	console.log('RESULT')
																	console.log(result)
																	console.log('===================')
																	console.log('RESULT FOR HOUR REAL')
																	console.log(resultForHourReal)
																	if (typeof result === 'object') {
																		
																		// o total foi calculado novamente e retirado o valor que o cliente ja pagou
																		if (pagarNovamente) {
																			pagamento.total = helper.moeda2float(result.valor) - helper.moeda2float(valorPago);
																			if (pagamento.total < 0)
																				pagamento.total = 0;
																			pagamento.total = helper.float2moeda(pagamento.total);
																		} else
																			pagamento.total = result.valor;

																		pagamento.tabela.valor = result.valor;
																		if (typeof resultForHourReal === 'object')
																			pagamento.tabela.hora = resultForHourReal.hora;
																	}
																}


															card.status = 'success';
															pagamento.tabela._id = priceTable._id;
															pagamento.tabela.nome = priceTable.nome;

															// calcula o horario para saida somando o horario inicial com a quantidade paga de horas

															card.limite_saida =  helper.somaDataHora(card.data_inicio, pagamento.tabela.hora);
															console.log('LIMITE PARA SAÍDA')
															console.log(card.limite_saida)

															if (typeof priceTable.tolerancia_saida !== 'undefined' && priceTable.tolerancia_saida !== '00:00' && !card.tolerancia) {
																// o cliente tem que ter minimo o tempo de tolerancia para sair
																// se a hora que ele ja pagou for maior ou igual ao tempo de tolerancia de saida entao nao adiciona a tolerancia de saida

																// calcula a diferenca da hora de inicio e o limite de saida (hora paga) o resultado é as horas e minutos que tem para sair
																var tempoParaSaida = helper.diferencaHora(pagamento.tabela.hora, permanencia);

																// verifica se esse tempo para saida é maior que a permanencia // os valores vao para timestamp para comparacao
																var timeStampTempoParaSaida = moment(tempoParaSaida, 'HH:mm').valueOf();
																var timeStampToleranciaSaida = moment(priceTable.tolerancia_saida, 'HH:mm').valueOf();
																if (timeStampTempoParaSaida <= timeStampToleranciaSaida) {
																	// console.log('O tempo para saida é inferior a tolerencia de saida da tabela');

																	card.limite_saida = helper.somaDataHora(moment().format('DD/MM/YYYY HH:mm'), priceTable.tolerancia_saida);

																	if (req.body.addHour)
																		card.limite_saida = helper.somaDataHora(card.limite_saida, req.body.addHour);

																} else {
																	// console.log('O tempo de saída é superior a tolerencia');
																}
															}

															card.pagamento = pagamento;

															if (card.permanencia)
																card.permanencia = helper.formataHora(card.permanencia);

															res.json(card);

														} else {
															res.json({ err: 1, message: 'Nenhuma tabela de preço padrão ativa.' });
														}

													});

												}
											});

										}

									} else {// fim if(card)
										res.json({ err: 1, message: 'Ticket não encontrado.' });
									}
								}); // fim Cartao.findOne
						} // fim if Diaria
					}); // fim Diaria.findOne
			} // fim if config
		}); // fim find config
	};
};

Controller.findClient = function () {
	var options = config.app(),
		self = this;

	return function(req, res, next) {
		if(!isNaN(req.body.code))
			req.body.code = parseInt(req.body.code, 10);
		else
			req.body.code = new RegExp(req.body.code, 'i');

		console.log(req.body.code);
		
		Cliente.findOne({$or:[{codigos: req.body.code}, {'carro.placa': req.body.code}], ativo: true}, null,{}, function(err, cliente) {
			if(err || !cliente) 
				res.json({err: 1, message: 'Cliente não encontrado.'});
			else {

				// console.log('Cliente do tipo '+cliente.tipo);

				if (cliente.tipo === 'Mensalista') {
					helper.retornaMensalidades(cliente, function (err, cliente) {
						if (!err && cliente)
							res.json({ err: 0, cliente: cliente });
					});

					// var mesInicio = moment(cliente.mensalidade.data_inicio, 'MM');
					// var mesFim = mesAtual + 6;
					// pega esses caras e da um loop pra ver se ja ta pago, se nao tiver
					// exibe nesse formato
					//<label><input type='checkbox' name="mensalidade[07][2016]" value="155,00"> 05/07/2016 R$ 155,00</label>
				} else
					res.json({ err: 0, cliente: cliente });
			}
		});
	};
};

Controller.comprarDiaria = function () {
	var options = config.app(),
		self = this;

	return function (req, res, next) {
		var Liberacao = require('../config/liberacao')(req.io);

		var barcode = req.body.code;

		if (!barcode) {
			res.json({ err: 1, message: 'Ocorreu um erro interno ao receber o código de barras.' });
		} else {

			// console.log('\n\n\n\n\n\n\nparams:');console.log(req.body);process.exit();

			Terminal.findOne({ tipo: 'Caixa', ip: helper.getIp(req) /*$or:[{ip: ip}, {mac: mac}]*/ }, function (err, terminal) {
				if (err || !terminal) {
					res.json({ err: 1, status: 'error', message: 'Terminal com IP ' + helper.getIp(req) + ' não encontrado ou não tem o tipo "Caixa".' });
				} else {



					Caixa.findOne({ '_id': req.params.id, '_usuario': req.session.login._id, 'finalizado': false }, function (err, caixa) {
						Configuracao.findOne({}, function (err, configuracao) {
							Diaria.findOne({
								$or: [{ codigos: barcode }, { 'carro.placa': barcode }], 'excluido.data_hora': null
							}, function (err, result) { // tentar deixar somente um request find com update		
								if (err || !result) {
									res.json({ err: 1, message: 'Diária não encontrada' })
								} else {



									result = result.toObject();

									result.temPagamentoValido = false;
									if (result.pagamento && result.pagamento.length > 0)
										result.temPagamentoValido = true;

									var mensagemErro = '';

									//if(result.temPagamentoValido === false && req.body.data_validade_inicio === helper.separaData(new Date()))
									if (!req.body.situacao || req.body.situacao === 'undefined')
										mensagemErro += 'Por favor marque a opção "Situação do veículo".<br />';

									if (result.temPagamentoValido && result.quantidade_dia && req.body.quantidade_dia <= result.quantidade_dia)
										mensagemErro += 'Você precisa adicionar mais dias para fazer outro pagamento.<br />';

									if (mensagemErro) {
										res.json({ err: 1, message: mensagemErro });
									} else {

										console.log('Encontrou resultado');

										var diaPagamento = req.body.quantidade_dia;
										if (result.quantidade_dia && result.quantidade_dia !== 'undefined')
											diaPagamento = Number(req.body.quantidade_dia) - Number(result.quantidade_dia);

										var pagamento = {
											_id: new mongoose.Types.ObjectId(),
											_cliente: null,
											_diaria: result._id,
											nome: 'Pagamento de Ticket - Diária',
											data_registro: new Date(),
											data_pagamento: new Date(),
											data_vencimento: new Date(),
											tipo: 'Diária',
											pago: true,
											quantidade_dia: diaPagamento,
											total: req.body.pagamento.total,
											valor: req.body.pagamento.total,
											valor_recebido: req.body.pagamento.total,
											troco: '0,00',
											forma_pagamento: req.body.pagamento.forma_pagamento,
											nota_fiscal: null
										};
										
										if(req.body.nota_fiscal === 'true'){
											if(req.body.pagamento.nota_fiscal && req.body.pagamento.nota_fiscal.cpf_cnpj){
												if(!helper.isCPFouCNPJ(req.body.pagamento.nota_fiscal.cpf_cnpj))
													return res.json({err: 1, message: 'CPF ou CNPJ está inválido.'});
											}
											notaFiscal.gerarNotaFiscal(req.body.pagamento.total, req.body.pagamento.nota_fiscal, prosseguirPagamento);
										}else{
											prosseguirPagamento();
										}
					
										function prosseguirPagamento(notaFiscalGerada){
					
											if(notaFiscalGerada)
												pagamento.nota_fiscal = notaFiscalGerada;
												
											if(pagamento.nota_fiscal && pagamento.nota_fiscal.rps)
												req.session.configuracao.app.nota_fiscal.numero = pagamento.nota_fiscal.rps;

											if(req.body.pagamento.forma_pagamento === 'Dinheiro' && req.body.pagamento.valor_recebido) {
												var floatValorRecebido = helper.moeda2float(req.body.pagamento.valor_recebido);
												var floatValor = helper.moeda2float(req.body.pagamento.total);
												if(floatValorRecebido >= floatValor) 
													pagamento.troco = helper.float2moeda(floatValorRecebido - floatValor);
												else 
													res.json({err: 1, message: 'O valor recebido deve ser maior ou igual ao total.'});
												pagamento.valor_recebido = req.body.pagamento.valor_recebido;
											} 
	
											if(req.body.data_validade_inicio)
												result.data_validade_inicio = moment(req.body.data_validade_inicio+' 00:00:01', 'DD/MM/YYYY HH:mm:ss').toISOString();
											
											result.data_validade_fim = moment(req.body.data_validade_fim+' 23:59:59', 'DD/MM/YYYY HH:mm:ss').toISOString();
											
											result.quantidade_dia = req.body.quantidade_dia;
	
											var total = helper.moeda2float(req.body.pagamento.total);
	
											pagamento._caixa = caixa._id;
											pagamento._usuario = caixa._usuario;
											pagamento.operador = caixa.usuario;
											pagamento.tabela = req.body.pagamento.tabela;
											pagamento.data_hora = new Date();
	
											if(!result.pagamento) result.pagamento = [];
											if(!caixa.pagamento) caixa.pagamento = [];
	
											result.pagamento.push(pagamento);
											caixa.pagamento.push(pagamento);
	
											
	
											caixa.valor_entrada = helper.moeda2float(caixa.valor_entrada) + total;
											caixa.valor_entrada = helper.float2moeda(caixa.valor_entrada);
	
											caixa.saldo = helper.moeda2float(caixa.saldo) + total;
											caixa.saldo = helper.float2moeda(caixa.saldo);
	
											var formaPagamento = req.body.pagamento.forma_pagamento;
											caixa.forma_pagamento[formaPagamento].total = helper.moeda2float(caixa.forma_pagamento[formaPagamento].total);
											caixa.forma_pagamento[formaPagamento].total = Number(caixa.forma_pagamento[formaPagamento].total) + Number(total);
											caixa.forma_pagamento[formaPagamento].total = helper.float2moeda(caixa.forma_pagamento[formaPagamento].total);
											caixa.forma_pagamento[formaPagamento].quantidade += 1;
	
											var categoria = 'Diária';
											caixa.categoria[categoria].total = helper.moeda2float(caixa.categoria[categoria].total);
											caixa.categoria[categoria].total = Number(caixa.categoria[categoria].total) + Number(total);
											caixa.categoria[categoria].total = helper.float2moeda(caixa.categoria[categoria].total);
	
											caixa.categoria[categoria].quantidade += 1;
	
	
	
											Caixa.findOneAndUpdate({ _id: caixa._id }, caixa, { multi: false }, function(err, caixa) {
												if(!err) {
													// console.log('\ndiaria final: ');
													// console.log(result);
													// process.exit(1);
	
													var pagamentoData = new Pagamento(pagamento);
													pagamentoData.save();
	
													Diaria.findOneAndUpdate({$or:[{codigos: barcode}, {'carro.placa': barcode}]}, result, {'new': true}, function (err, diaria) {
														if(diaria && !err) {
															
															// da entrada do carro no patio
															// da entrada do carro no monitor de atividade
															if(req.body.situacao === 'Dentro do Pátio') {
	
																var cartao = new Cartao({	
																	_id: new mongoose.Types.ObjectId(),
																	_usuario: req.session.login._id,
																	_diaria: diaria._id,
																	operador: req.session.login.nome,
																	nome: '',
																	codigos: [barcode],
																	sempre_liberado: false,
																	liberado: true,
																	tipo: 'Diária',
																	tipo_veiculo: diaria.tipo_veiculo ? diaria.tipo_veiculo : '',
																	_terminal: terminal._id,
																	terminal: {
																		nome: terminal.nome,
																		numero: terminal.numero ? terminal.numero : ''
																	},
																	carro: {
																		placa: diaria.carro.placa ? diaria.carro.placa : '',
																		marca: diaria.carro.marca ? diaria.carro.marca : '',
																		modelo: diaria.carro.modelo ? diaria.carro.modelo : '',
																		cor: diaria.carro.cor ? diaria.carro.cor : '',
																	},
																	data_cadastro: new Date(),
																	data_inicio:  new Date(),
																	data_fim: null,
																	excluido: {
																		data_hora: null
																	}
																}).save(function(err) {
																	if(!err) {
																		Liberacao.insereMovimentoPatio({
																			_cliente: null,
																			nome: 'SEM CADASTRO',
																			codigo: barcode,
																			tipo: 'Diária',
																			descricao: '',
																			sentido: 'Entrada',
																			autorizado: true,
																			_terminal: terminal._id,
																			terminal: {
																				nome: terminal.nome,
																				numero: terminal.numero ? terminal.numero : ''
																			},
																		});	
																	}
																});
	
															}
	
															self.showDiaria(diaria, null, function(err, diaria) {
																var perguntarNotaFiscal = false;
																if(configuracao.app.nota_fiscal.ativo && !configuracao.app.nota_fiscal.emissao_automatica)
																	perguntarNotaFiscal = true;
																
																res.json({card: diaria, caixa: caixa, err: false, message: 'Pagamento realizado com sucesso.', perguntarNotaFiscal: perguntarNotaFiscal});
															});
	
														} else {
															res.json({err: 1, message: 'Ocorreu um erro interno, tente novamente.'});
															console.log('err'+err);
														}
		
													});
												} // fim if err
											}); // fim update caixa
										}
									} // fim if menssagemErro
								} // fim if(err)
							});	// fim diaria find	
						}); // fim configuracao find
					}); // fim caixa find
				} // fim if(err || !terminal) {
			}); // fim terminal find
		} // fim if barcode
	};
};

Controller.confirmPayment = function () {
	var options = config.app(),
		self = this;

	return function (req, res, next) {

		// console.log(req.body.pagamento.tabela);

		var barcode = req.body.code;
		var venderHora = req.body.addHour;

		var caixa = req.session.caixa;
		var configuracao = req.session.configuracao;


		Cartao.findOne({
			$or: [{ codigos: barcode }, { 'carro.placa': barcode }], 'excluido.data_hora': null
		}, function (err, result) { // tentar deixar somente um request find com update

			var upsert = false;
			// se o cartão não existia no banco iremos validar o codigo de barras e inserir no banco ja como pago
			if (!result) {

				if (configuracao.app.entrada_offline === false) {
					res.json({ err: 1, message: 'Entrada offline desabilitada.' });
					return false;
				}

				// console.log('Não encontrou resultado para o codigo '+barcode);
				var pattern = helper.decodeBarcode(barcode);

				upsert = true;

				result = {
					_id: new mongoose.Types.ObjectId(),
					tipo: 'Permanência',
					nome: barcode,
					sempre_liberado: false,
					liberado: false,
					data_inicio: moment(pattern.dia + '/' + pattern.mes + '/' + pattern.ano + ' ' + pattern.hora + ':' + pattern.minuto, 'DD/MM/YYYY HH:mm').toISOString(),
					pagamento: [],
					codigos: [barcode],
					ticket: {
						linha1: configuracao.ticket.linha1 || '',
						linha2: configuracao.ticket.linha2 || '',
						linha3: configuracao.ticket.linha3 || '',
						linha4: configuracao.ticket.linha4 || '',
						linha5: configuracao.ticket.linha5 || '',
						//linha6: configuracao.ticket.linha6
					},
					hora_comprada: venderHora
				};

			} else {
				result = result.toObject();
				console.log('Encontrou resultado');
			}



			result.liberado = true;
			// console.log('aqui');
			// console.log(req.body.nota_fiscal);

			
			var pagamento = {
				_id: new mongoose.Types.ObjectId(),
				_cliente: null,
				_cartao: result._id,
				_caixa: caixa._id,
				_usuario: caixa._usuario,
				nome: 'Pagamento de Ticket',
				data_registro: new Date(),
				data_pagamento: new Date(),
				data_vencimento: new Date(),
				tipo: 'Permanência',
				pago: true,
				total: req.body.pagamento.total,
				valor: req.body.pagamento.total,
				valor_recebido: req.body.pagamento.total,
				troco: '0,00',
				forma_pagamento: req.body.pagamento.forma_pagamento,
				operador: caixa.usuario,
				tabela: req.body.pagamento.tabela,
				data_hora: new Date(),
				nota_fiscal: null
			};
			
			if(req.body.nota_fiscal === 'true'){
				if(req.body.pagamento.nota_fiscal && req.body.pagamento.nota_fiscal.cpf_cnpj){
					if(!helper.isCPFouCNPJ(req.body.pagamento.nota_fiscal.cpf_cnpj))
						return res.json({err: 1, message: 'CPF ou CNPJ está inválido.'});
				}
				notaFiscal.gerarNotaFiscal(req.body.pagamento.total, req.body.pagamento.nota_fiscal, prosseguirPagamento);
			}else{
				prosseguirPagamento();
			}

			function prosseguirPagamento(notaFiscalGerada){

				if(notaFiscalGerada)
					pagamento.nota_fiscal = notaFiscalGerada;
					
				if(pagamento.nota_fiscal && pagamento.nota_fiscal.rps)
					req.session.configuracao.app.nota_fiscal.numero = pagamento.nota_fiscal.rps;
	
				if(req.body.pagamento.forma_pagamento === 'Dinheiro' && req.body.pagamento.valor_recebido) {
					var floatValorRecebido = helper.moeda2float(req.body.pagamento.valor_recebido);
					var floatValor = helper.moeda2float(req.body.pagamento.total);
					if(floatValorRecebido >= floatValor) 
						pagamento.troco = helper.float2moeda(floatValorRecebido - floatValor);
					else 
						res.json({err: 1, message: 'O valor recebido deve ser maior ou igual ao total.'});
					pagamento.valor_recebido = req.body.pagamento.valor_recebido;
				} 
	
				result.permanencia = req.body.permanencia;
				result.limite_saida = moment(req.body.limite_saida, 'DD/MM/YYYY HH:mm').toISOString(); // converte para isodate
	
	
	
				// Terminal.findOne({tipo: 'Saída', ip: helper.getIp(req)}, function(err, terminal) {
				// 	if(!err && terminal) {
				// 		if(terminal.saida && terminal.saida._equipamento) {
				// 			Equipamento.findOne({_id: terminal.saida._equipamento}, function(err, equipamento) {
				// 				if(!err && equipamento) {
				// 					req.io.emit('liberacao', {
				// 						master: 0,
				// 						operacao: 'Ação autorizada',
				// 						mensagem_linha1: configuracao.mensagem.acesso_liberado_linha1,
				//        				mensagem_linha2: configuracao.mensagem.acesso_liberado_linha2,
				// 						equipamento: equipamento,
				// 						sentido: 'Saída'
				// 					});
				// 				}
				// 			});
				// 		}
				// 	}
				// });

				
				var total = helper.moeda2float(req.body.pagamento.total);
	
	
				caixa.valor_entrada = helper.moeda2float(caixa.valor_entrada) + total;
				caixa.valor_entrada = helper.float2moeda(caixa.valor_entrada);
	
				caixa.saldo = helper.moeda2float(caixa.saldo) + total;
				caixa.saldo = helper.float2moeda(caixa.saldo);
	
	
				var formaPagamento = req.body.pagamento.forma_pagamento;
				caixa.forma_pagamento[formaPagamento].total = helper.moeda2float(caixa.forma_pagamento[formaPagamento].total);
				caixa.forma_pagamento[formaPagamento].total = Number(caixa.forma_pagamento[formaPagamento].total) + Number(total);
				caixa.forma_pagamento[formaPagamento].total = helper.float2moeda(caixa.forma_pagamento[formaPagamento].total);
				caixa.forma_pagamento[formaPagamento].quantidade += 1;
	
				var categoria = 'Permanência';
				caixa.categoria[categoria].total = helper.moeda2float(caixa.categoria[categoria].total);
				caixa.categoria[categoria].total = Number(caixa.categoria[categoria].total) + Number(total);
				caixa.categoria[categoria].total = helper.float2moeda(caixa.categoria[categoria].total);
	
				caixa.categoria[categoria].quantidade += 1;
	
				Caixa.findOneAndUpdate({ _id: caixa._id }, caixa, { multi: false }, function(err, caixa) {
					if(!err) {
						
						var pagamentoData = new Pagamento(pagamento);								
						pagamentoData.save();
	
						if(!result.pagamento) result.pagamento = [];
						result.pagamento.push(pagamento); // somente pra facilitar as consultas, campo desnecessario
						
						Cartao.findOneAndUpdate({$or:[{codigos: barcode}, {'carro.placa': barcode}]}, result, {upsert: upsert, 'new': true}, function (err, card) {
							if(card) {
								card = card.toObject();
	
								if(card.data_inicio)
									card.data_inicio = moment(card.data_inicio).format('DD/MM/YYYY HH:mm');
								if(card.data_fim)
									card.data_fim = moment(card.data_fim).format('DD/MM/YYYY HH:mm');
								if(card.limite_saida)
									card.limite_saida = moment(card.limite_saida).format('DD/MM/YYYY HH:mm');
	
								card.status = 'success';
								
								res.json({card: card, caixa: caixa, err: false, message: 'Pagamento realizado com sucesso.'});
							} else {
								res.json({err: 1, message: 'Ocorreu um erro interno, tente novamente.'});
								console.log('err'+err);
							}
	
						});
					} // fim if err
				}); // fim update caixa
			}//fim função prosseguirPagamento
		});
	};
};

Controller.pagarMensalidade = function () {
	var options = config.app(),
		self = this;

	return function (req, res, next) {
		var barcode = req.body.code;

		req.body.pagamento.valor = req.body.pagamento.total;
		

		Caixa.findOne({ '_id': req.params.id, '_usuario': req.session.login._id, 'finalizado': false }, function (err, caixa) {
			Configuracao.findOne({}, function (err, configuracao) {
				Cliente.findOne({ $or: [{ codigos: barcode, ativo: true }, { 'carro.placa': barcode, ativo: true }] }, null, {}, function (err, cliente) {
					if (err || !cliente) {
						// console.log('Cliente inativo ou não encontrado.');
						res.json({ err: 1, message: 'Cliente inativo ou não encontrado.' });
					} else {
						// console.log(2);

						if (req.body.pagamento.forma_pagamento !== 'Dinheiro')
							req.body.pagamento.valor_recebido = req.body.pagamento.valor;

						var pagamento = {
							_id: new mongoose.Types.ObjectId(),
							_cliente: cliente._id,
							_caixa: caixa._id,
							_usuario: req.session.login._id,
							nome: 'Pagamento de Mensalidade',
							data_registro: new Date(),
							data_pagamento: new Date(),
							data_vencimento: new Date(),
							tipo: 'Mensalidade',
							pago: true,
							valor: req.body.pagamento.valor,
							valor_recebido: req.body.pagamento.valor_recebido,
							troco: null,
							forma_pagamento: req.body.pagamento.forma_pagamento,
							nota_fiscal: null
						};

						

					if(req.body.nota_fiscal === 'true'){
						console.log('entrou')
						if(req.body.pagamento.nota_fiscal && req.body.pagamento.nota_fiscal.cpf_cnpj){
							if(!helper.isCPFouCNPJ(req.body.pagamento.nota_fiscal.cpf_cnpj))
								return res.json({err: 1, message: 'CPF ou CNPJ está inválido.'});
						}
						notaFiscal.gerarNotaFiscal(req.body.pagamento.total, req.body.pagamento.nota_fiscal, prosseguirPagamento);
					}else{
						prosseguirPagamento();
					}

					function prosseguirPagamento(notaFiscalGerada){
						console.log('imprimindo nota fiscal de mensalista');
						console.log(notaFiscalGerada);

						if(notaFiscalGerada)
							pagamento.nota_fiscal = notaFiscalGerada;
							
						console.log('imprimindo pagamento nota fiscal');
						console.log(pagamento.nota_fiscal);
						if(pagamento.nota_fiscal && pagamento.nota_fiscal.rps)
							req.session.configuracao.app.nota_fiscal.numero = pagamento.nota_fiscal.rps;



						if(req.body.pagamento.forma_pagamento === 'Dinheiro' && req.body.pagamento.valor_recebido) {
							var floatValorRecebido = helper.moeda2float(req.body.pagamento.valor_recebido);
							var floatValor = helper.moeda2float(req.body.pagamento.valor);
							if(floatValorRecebido >= floatValor) 
								pagamento.troco = helper.float2moeda(floatValorRecebido - floatValor);
							else 
								res.json({err: 1, message: 'O valor recebido deve ser maior ou igual ao total.'});
							pagamento.valor_recebido = req.body.pagamento.valor_recebido;
						} 

						if(!caixa.pagamento) caixa.pagamento = [];

						caixa.pagamento.push(pagamento);

						// pega de volta o pagamento agora com o campo _id
						pagamento = caixa.pagamento[caixa.pagamento.length-1];

						caixa.valor_entrada = helper.float2moeda( helper.moeda2float(caixa.valor_entrada) + helper.moeda2float(pagamento.valor) );
						caixa.saldo = helper.float2moeda( helper.moeda2float(caixa.saldo) + helper.moeda2float(pagamento.valor) );
						caixa.forma_pagamento[req.body.pagamento.forma_pagamento].total = helper.float2moeda( helper.moeda2float(caixa.forma_pagamento[req.body.pagamento.forma_pagamento].total) + helper.moeda2float(pagamento.valor) );
						caixa.forma_pagamento[req.body.pagamento.forma_pagamento].quantidade += 1;
						caixa.categoria.Mensalista.total = helper.float2moeda( helper.moeda2float(caixa.categoria.Mensalista.total) + helper.moeda2float(pagamento.valor) );
						caixa.categoria.Mensalista.quantidade += 1;

						cliente.saldo = helper.float2moeda( helper.moeda2float(cliente.saldo) + helper.moeda2float(pagamento.valor) );
						
						// return res.json({ err: 1, message: 'Parando requsição.' });
					TabelaDePreco.findOne({$or:[{ _id: cliente.tabela._id},
												{tipo: 'Mensalidade', ativo: true, padrao: true}]}, function(err, tabela){
						if(!err && tabela){
							pagamento.tabela = {_id: tabela._id, nome: tabela.nome}

							// var pagamento = {
							// 	_id: new mongoose.Types.ObjectId(),
							// 	_cliente: cliente._id,
							// 	_caixa: caixa._id,
							// 	tabela: {_id: tabela._id, nome: tabela.nome},
							// 	nome: 'Pagamento de Mensalidade',
							// 	data_registro: new Date(),
							// 	data_pagamento: new Date(),
							// 	data_vencimento: new Date(),
							// 	tipo: 'Mensalidade',
							// 	pago: true,
							// 	valor: req.body.pagamento.valor,
							// 	valor_recebido: req.body.pagamento.valor_recebido,
							// 	troco: null,
							// 	forma_pagamento: req.body.pagamento.forma_pagamento
							// };
	
							// if (req.body.pagamento.forma_pagamento === 'Dinheiro' && req.body.pagamento.valor_recebido) {
							// 	var floatValorRecebido = helper.moeda2float(req.body.pagamento.valor_recebido);
							// 	var floatValor = helper.moeda2float(req.body.pagamento.valor);
							// 	if (floatValorRecebido >= floatValor)
							// 		pagamento.troco = helper.float2moeda(floatValorRecebido - floatValor);
							// 	else
							// 		res.json({ err: 1, message: 'O valor recebido deve ser maior ou igual ao total.' });
							// 	pagamento.valor_recebido = req.body.pagamento.valor_recebido;
							// }
	
							// if (!caixa.pagamento) caixa.pagamento = [];
	
							// caixa.pagamento.push(pagamento);
	
							// // pega de volta o pagamento agora com o campo _id
							// pagamento = caixa.pagamento[caixa.pagamento.length - 1];
	
							// caixa.valor_entrada = helper.float2moeda(helper.moeda2float(caixa.valor_entrada) + helper.moeda2float(pagamento.valor));
							// caixa.saldo = helper.float2moeda(helper.moeda2float(caixa.saldo) + helper.moeda2float(pagamento.valor));
							// caixa.forma_pagamento[req.body.pagamento.forma_pagamento].total = helper.float2moeda(helper.moeda2float(caixa.forma_pagamento[req.body.pagamento.forma_pagamento].total) + helper.moeda2float(pagamento.valor));
							// caixa.forma_pagamento[req.body.pagamento.forma_pagamento].quantidade += 1;
							// caixa.categoria.Mensalista.total = helper.float2moeda(helper.moeda2float(caixa.categoria.Mensalista.total) + helper.moeda2float(pagamento.valor));
							// caixa.categoria.Mensalista.quantidade += 1;
	
							// cliente.saldo = helper.float2moeda(helper.moeda2float(cliente.saldo) + helper.moeda2float(pagamento.valor));
	
							if (!cliente.mensalidade.historico)
								cliente.mensalidade.historico = [];
	
							for (var key in req.body.mensalidade) {
								if (req.body.mensalidade.hasOwnProperty(key)) {
									// console.log('Mensalidade paga '+ key +  ' -> ' + req.body.mensalidade[key]);
	
									var data = key.split('/');
									cliente.mensalidade.historico.push({
										_pagamento: pagamento._id,
										mes: data[1],
										ano: data[2],
										dia_vencimento: data[0],
										pago: true,
										atrasado: false,
										valor: req.body.mensalidade[key]
									});
								}
							}
	
							Caixa.findOneAndUpdate({ _id: caixa._id }, caixa, { multi: false, 'new': true }, function (err, caixa) {
								if (!err && caixa) {
									var pagamentoData = new Pagamento(pagamento);
									pagamentoData.save();
	
									Cliente.findOneAndUpdate({ _id: cliente._id }, cliente, { 'new': true }, function (err, cliente) {
										if (!err && cliente) {
											helper.retornaMensalidades(cliente, function (err, cliente) {
												if (!err && cliente) {
													var perguntarNotaFiscal = false;
													if (configuracao.app.nota_fiscal.ativo && !configuracao.app.nota_fiscal.emissao_automatica)
														perguntarNotaFiscal = true;
	
													res.json({ err: '0', message: 'Pagamento realizado com sucesso.', perguntarNotaFiscal: perguntarNotaFiscal, cliente: cliente, caixa: caixa, pagamento: pagamento });
												}
	
											});
										}
										else {
											res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.' });
											// console.log('err');
										}
									});
								} else {
									res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.' });
									// console.log('err');
								}
							}); // fim update caixa
							}else{
							res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.' });
						}
						});
					}
					}
				});
			}); // fim configuracao find
		}); // fim caixa findcliente;
	}
}
Controller.buyCredit = function () {
	var options = config.app(),
		self = this;

	return function (req, res, next) {
		var barcode = req.body.code;

		// console.log(1);

		Caixa.findOne({ '_id': req.params.id, '_usuario': req.session.login._id, 'finalizado': false }, function (err, caixa) {
			Configuracao.findOne({}, function (err, configuracao) {
				Cliente.findOne({ codigos: barcode, ativo: true }, null, {}, function (err, cliente) {
					if (err || !cliente) {
						console.log('Cliente inativo ou não encontrado.');
						res.json({ err: 1, message: 'Cliente inativo ou não encontrado.' });
					} else {
						console.log(req.session.caixa);

						var pagamento = {
							_id: new mongoose.Types.ObjectId(),
							_cliente: cliente._id,
							_caixa: req.session.caixa._id,
							_usuario: req.session.login._id,
							nome: 'Compra de crédito Pré-Pago',
							data_registro: new Date(),
							data_pagamento: new Date(),
							data_vencimento: new Date(),
							tipo: 'Pré-Pago',
							pago: true,
							valor: req.body.pagamento.valor,
							valor_recebido: req.body.pagamento.valor,
							troco: null,
							forma_pagamento: req.body.pagamento.forma_pagamento,
							nota_fiscal: null
						};
						
						if(req.body.nota_fiscal === 'true'){
							if(req.body.pagamento.nota_fiscal && req.body.pagamento.nota_fiscal.cpf_cnpj){
								if(!helper.isCPFouCNPJ(req.body.pagamento.nota_fiscal.cpf_cnpj))
									return res.json({err: 1, message: 'CPF ou CNPJ está inválido.'});
							}
							notaFiscal.gerarNotaFiscal(req.body.pagamento.valor, req.body.pagamento.nota_fiscal, prosseguirPagamento);
						}else{
							prosseguirPagamento();
						}
	
						function prosseguirPagamento(notaFiscalGerada){
	
							if(notaFiscalGerada)
								pagamento.nota_fiscal = notaFiscalGerada;
								
							if(pagamento.nota_fiscal && pagamento.nota_fiscal.rps)
								req.session.configuracao.app.nota_fiscal.numero = pagamento.nota_fiscal.rps;
					
							if(req.body.pagamento.forma_pagamento === 'Dinheiro' && req.body.pagamento.valor_recebido) {
								var floatValorRecebido = helper.moeda2float(req.body.pagamento.valor_recebido);
								var floatValor = helper.moeda2float(req.body.pagamento.valor);
								if(floatValorRecebido >= floatValor)
									pagamento.troco = helper.float2moeda(floatValorRecebido - floatValor);
								else 
									res.json({err: 1, message: 'O valor recebido deve ser maior ou igual ao valor do crédito'});
								pagamento.valor_recebido = req.body.pagamento.valor_recebido;
							} 
	
							if(!caixa.pagamento) caixa.pagamento = [];
							
							//caixa.pagamento.push(pagamento);
							caixa.valor_entrada = helper.float2moeda( helper.moeda2float(caixa.valor_entrada) + helper.moeda2float(pagamento.valor) );
							caixa.saldo = helper.float2moeda( helper.moeda2float(caixa.saldo) + helper.moeda2float(pagamento.valor) );
							
							caixa.forma_pagamento[req.body.pagamento.forma_pagamento].total = helper.float2moeda( helper.moeda2float(caixa.forma_pagamento[req.body.pagamento.forma_pagamento].total) + helper.moeda2float(pagamento.valor) );
							caixa.forma_pagamento[req.body.pagamento.forma_pagamento].quantidade += 1;
							caixa.categoria['Pré-Pago'].total = helper.float2moeda( helper.moeda2float(caixa.categoria['Pré-Pago'].total) + helper.moeda2float(pagamento.valor) );
							caixa.categoria['Pré-Pago'].quantidade += 1;
							
							cliente.saldo = helper.float2moeda( helper.moeda2float(cliente.saldo) + helper.moeda2float(pagamento.valor) );
							
							Caixa.findOneAndUpdate({ _id: caixa._id }, caixa, {multi: false, 'new': true}, function(err, caixa) {
								if(!err && caixa) {
	
									var pagamentoData = new Pagamento(pagamento);
									pagamentoData.save();
											
									Cliente.findOneAndUpdate({_id: cliente._id}, cliente, {'new': true}, function (err, cliente) {
										if(!err && cliente) {
											var perguntarNotaFiscal = false;
											if(configuracao.app.nota_fiscal.ativo && !configuracao.app.nota_fiscal.emissao_automatica)
												perguntarNotaFiscal = true;
	
											res.json({cliente: cliente, caixa: caixa, err: '0', message: 'Crédito adicionado com sucesso.', perguntarNotaFiscal: perguntarNotaFiscal, pagamento: pagamentoData});
										} else {
											res.json({err: 1, message: 'Ocorreu um erro interno, tente novamente.'});
											console.log('err');
										}
									});
								} else {
									res.json({err: 1, message: 'Ocorreu um erro interno, tente novamente.'});
									console.log('err');
								}
							}); // fim update caixa
						}
					}
				});
			}); // fim configuracao find
		}); // fim caixa find
	};
};

// expose this inherited controller
module.exports = Controller;

// ??????????????????????

function getIdEstado(estado) { // http://www.ibge.gov.br/home/geociencias/areaterritorial/principal.shtm
	switch (estado.toUpperCase()) {
		case 'RONDÔNIA':
			return 11;
		case 'ACRE':
			return 12;
		case 'AMAZONAS':
			return 13;
		case 'RORAIMA':
			return 14;
		case 'Pará':
			return 15;
		case 'Amapá':
			return 16;
		case 'Tocantins':
			return 17;
		case 'Maranhão':
			return 21;
		case 'Piauí':
			return 22;
		case 'Ceará':
			return 23;
		case 'Rio Grande do Norte':
			return 24;
		case 'Paraíba':
			return 25;
		case 'Pernambuco':
			return 26;
		case 'Alagoas':
			return 27;
		case 'Sergipe':
			return 28;
		case 'Bahia':
			return 29;
		case 'Minas Gerais':
			return 31;
		case 'Espírito Santo':
			return 32;
		case 'Rio de Janeiro':
			return 33;
		case 'São Paulo':
			return 35;
		case 'Paraná':
			return 41;
		case 'Santa Catarina':
			return 42;
		case 'Rio Grande do Sul (*)': // Inclusive 10.152,408 km2 e 2.832,194 km2 referentes às Lagoas dos Patos e Mirim, respectivamente, incorporadas à área do Estado segundo a Constituição Estadual de 1988, não constituindo área municipal.
			return 43;
		case 'Mato Grosso do Sul':
			return 50;
		case 'Mato Grosso':
			return 51;
		case 'Goiás':
			return 52;
		case 'Distrito Federal':
			return 53;
	}
};

function getSiglaEstado(estado) {
	switch (estado.toUpperCase()) {
		case 'ACRE':
			return 'AC';
		case 'ALAGOAS':
			return 'AL';
		case 'AMAPÁ':
			return 'AP';
		case 'AMAZONAS':
			return 'AM';
		case 'BAHIA':
			return 'BA';
		case 'CEARÁ':
			return 'CE';
		case 'DISTRITO FEDERAL':
			return 'DF';
		case 'ESPÍRITO SANTO':
			return 'ES';
		case 'GOIÁS':
			return 'GO';
		case 'MARANHÃO':
			return 'MA';
		case 'MATO GROSSO':
			return 'MT';
		case 'MATO GROSSO DO SUL':
			return 'MS';
		case 'MINAS GERAIS':
			return 'MG';
		case 'PARÁ':
			return 'PA';
		case 'PARAÍBA':
			return 'PB';
		case 'PARANÁ':
			return 'PR';
		case 'PERNAMBUCO':
			return 'PE';
		case 'PIAUÍ':
			return 'PI';
		case 'RIO DE JANEIRO':
			return 'RJ';
		case 'RIO GRANDE DO NORTE':
			return 'RN';
		case 'RIO GRANDE DO SUL':
			return 'RS';
		case 'RONDÔNIA':
			return 'RO';
		case 'SANTA CATARINA':
			return 'SC';
		case 'SÃO PAULO':
			return 'SP';
		case 'SERGIPE':
			return 'SE';
		case 'TOCANTINS':
			return 'TO';
	}
};

function getCodigoMunicipio(municipio) { // http://www.ibge.gov.br/home/geociencias/areaterritorial/area.shtm
	switch (municipio.toUpperCase()) {
		case 'MANAUS':
			return 1302603;

	}
}
