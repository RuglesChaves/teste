/*
ainda estou trabalhando neste bloco de codigo, deixa ele comentando 

'use strict';
// alteracao exibindo a msg de tolerancia
// problema pinpad operacao cancelada // em CC visa
// 

var moment 	 = require('moment');
var helper 	 = require('../config/helper');
var config 	 = require('../config');
var mongoose = require('mongoose');

var Cartao 			= require('../models/cartao'),
	TabelaDePreco 	= require('../models/tabela-preco'),
	Equipamento 	= require('../models/equipamento'),
	Pagamento 		= require('../models/pagamento'),
	CaixaController = require('../controllers/caixa');

var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'api',
	menu			: '',
	pageName		: '',
	pageNamePlural	: '',
	model 			: 'cartao'
});

Controller.customRoutes = function(app) {
	 app.post('/'+this.route+'/barcode/find', this.find())
	 	.post('/'+this.route+'/totem/confirmar-pagamento', this.confirmPayment())
	 	.get('/'+this.route+'/pagamento/:codigo', this.printPagamento())
};

Controller.printPagamento = function() {
	return function(req, res, next) {
		console.log('printPagamento');
		req.options = config.app();
		req.options.layout = 'print';

		if(req.query.printComPopup)
			req.options.printComPopup = true;
		
		console.log('Procurando o cartao com o codigo '+req.params.codigo);

		req.options.configuracao = req.session.configuracao;
		req.options.config = req.session.configuracao;

		Cartao.findOne({codigos: req.params.codigo}, function(err, result) {
			// console.log(result)
			
			if(!err && result) {
				console.log('Cartao encontrado, preparando impressao');
				var pattern = helper.decodeBarcode(req.params.codigo);
				if(pattern) {
					result = result.toObject();
					result.code = result.codigos[0];
					result.data = pattern.dia+'/'+pattern.mes;
					result.hora = pattern.hora+':'+pattern.minuto+':'+pattern.segundo;
				} 

	  	  		req.options.result = result;

				//res.render('ticket/pagamento', req.options, function(err, html) {
				//	res.json({html: html});
				//});


				res.render('ticket/pagamento', req.options);



			} else {
				console.log('Pagamento não encontrado');
				res.json({err: 1, message: 'Pagamento não encontrado'});
			}
		});
	};
};

Controller.find = function() {

	return function(req, res, next) {
		console.log('function find()');
		Cartao.findOne({codigos: req.body.code, 'excluido.data_hora': null}, function(err, card) {
			if(card)
				card = card.toObject();
			else {
				var pattern = helper.decodeBarcode(req.body.code);
				if(pattern) {

					if(req.session.configuracao.app.entrada_offline === false) {
						res.json({err: 1, message: 'Modo OFFLINE desabilitado.'});
						return;
					}

					card = {
						_id: new mongoose.Types.ObjectId(),
						tipo: 'Permanência',
						nome: req.body.code,
						sempre_liberado: false,
						liberado: false,
						data_inicio: moment(pattern.dia+'/'+pattern.mes+'/'+pattern.ano+' '+pattern.hora+':'+pattern.minuto, 'DD/MM/YYYY HH:mm').toISOString(),
						codigos: [req.body.code]
					};
				} else {
					res.json({err: 1, message: 'Ticket não encontrado e fora do padrão BRA Parking.'});
					return;
				}
			} 
				
			if(card.data_fim) {
				card.liberado = true; // liberado exibe o bloco bloqueado -.-
			} else {
				var pagarNovamente = false;
				var valorPago = 0;
				if(card.limite_saida && card.pagamento.length) {
					var timeStampLimiteSaida = moment(card.limite_saida).valueOf();
            		var timeStampDataHoraAtual = moment(moment()).valueOf();
                	if(timeStampDataHoraAtual > timeStampLimiteSaida) {
                		card.liberado = false;
                		pagarNovamente = true;

						// console.log('ticket excedeu o limite para saida');
						card.status = 'success';
                		card.err = false;
						card.message = 'Ticket excedeu o limite para saída.';

                		for(var i = card.pagamento.length - 1; i >= 0; i--) {
                			//console.log('card.pagamento[i].total '+card.pagamento[i].total);
							valorPago += helper.moeda2float(card.pagamento[i].total);
                		}
                		// console.log('valor total pago '+valorPago);
                		valorPago = helper.float2moeda(valorPago);
                	}
				}

			}

			if(card.data_inicio)
				card.data_inicio = moment(card.data_inicio).format('DD/MM/YYYY HH:mm');

			if(card.data_fim)
				card.data_fim = moment(card.data_fim).format('DD/MM/YYYY HH:mm');

			if(card.limite_saida)
				card.limite_saida = moment(card.limite_saida).format('DD/MM/YYYY HH:mm');

		
			if(card.liberado) {
				card.err = true;
				card.message = 'Este ticket já foi pago.';

				if(card.tolerancia)
					card.message = 'Ticket saiu na tolerância.';

				if(card.permanencia)
					card.permanencia = helper.formataHora(card.permanencia);

				card.status = 'error';
				res.json(card);
			} else { // bloqueado

				// calcula o tempo de permanencia (diferença entre a data atual e a data_inicio)

				var pagamento = {
					tabela: {}
				};

				var filter = {
					tipo: 'Permanência',
					ativo: true
				};

				if(req.body.id_tabela)
					filter._id = req.body.id_tabela;
				else
					filter.padrao = true;

				TabelaDePreco.findOne(filter).exec(function(err, priceTable) {
					if(typeof priceTable !== 'undefined' && priceTable && !err) {

						card.permanencia = helper.diferencaData(moment(), card.data_inicio);
						var permanencia = card.permanencia;

						// adiciona o valor a ser vendido com a opcao Vender Horas
						if(req.body.addHour) {
							permanencia = helper.somaHora(permanencia, req.body.addHour);
							card.addHourDEBUG = helper.formataHora(req.body.addHour);
						}

						card.permanenciaDEBUG = helper.formataHora(permanencia);

						// verifica se esta dentro da tolerancia de entrada
						var timeStampPermanencia = moment(permanencia, 'HH:mm').valueOf();
						var timeStampTolerancia = moment(priceTable.tolerancia_entrada, 'HH:mm').valueOf();

						if(timeStampPermanencia < timeStampTolerancia && priceTable.tolerancia_entrada !== '00:00' && priceTable.tolerancia_entrada !== 'undefined') {
							var tempoRestanteSaida = helper.diferencaHora(priceTable.tolerancia_entrada, permanencia);
							// console.log('na tolerancia');
							card.tolerancia = true;
							// falta exibir quanto tempo para saida
							// no checkout exibir os pagamentos
							card.message = 'Ticket dentro do periodo de tolerância, restam <b>'+tempoRestanteSaida+'</b> para saída.';
							// card.err = false;
						} else
							// console.log('fora da tolerancia');


						if(priceTable && !card.tolerancia) {
							var result = CaixaController.calculaPrecoTabela(permanencia, priceTable);
							if(typeof result === 'object') {

								// o total foi calculado novamente e retirado o valor que o cliente ja pagou
								if(pagarNovamente) {
									pagamento.total = helper.moeda2float(result.valor) - helper.moeda2float(valorPago);
									if(pagamento.total < 0)
										pagamento.total = 0;
									pagamento.total = helper.float2moeda(pagamento.total);
								} else
									pagamento.total = result.valor;

								pagamento.tabela.valor = result.valor;
								pagamento.tabela.hora = result.hora;
							}
						}


						card.status = 'success';
						pagamento.tabela._id = priceTable._id;
						pagamento.tabela.nome = priceTable.nome;

						// calcula o horario para saida somando o horario inicial com a quantidade paga de horas
						// console.log('\ncard.data_inicio: '+card.data_inicio);

						// console.log('\ncard.limite_saida: '+card.limite_saida);

						card.limite_saida = helper.somaDataHora(card.data_inicio, pagamento.tabela.hora);

						// console.log('\ncard.limite_saida: '+card.limite_saida);

						if(typeof priceTable.tolerancia_saida !== 'undefined' && priceTable.tolerancia_saida !== '00:00' && !card.tolerancia) {
							// o cliente tem que ter minimo o tempo de tolerancia para sair
							// se a hora que ele ja pagou for maior ou igual ao tempo de tolerancia de saida entao nao adiciona a tolerancia de saida

							// calcula a diferenca da hora de inicio e o limite de saida (hora paga) o resultado é as horas e minutos que tem para sair
							var tempoParaSaida = helper.diferencaHora(pagamento.tabela.hora, permanencia);

							// verifica se esse tempo para saida é maior que a permanencia // os valores vao para timestamp para comparacao
							var timeStampTempoParaSaida = moment(tempoParaSaida, 'HH:mm').valueOf();
							var timeStampToleranciaSaida = moment(priceTable.tolerancia_saida, 'HH:mm').valueOf();
							if(timeStampTempoParaSaida <= timeStampToleranciaSaida) {
								// console.log('O tempo para saida é inferior a tolerencia de saida da tabela');

							 	card.limite_saida = helper.somaDataHora(moment().format('DD/MM/YYYY HH:mm'), priceTable.tolerancia_saida);

								if(req.body.addHour)
									card.limite_saida = helper.somaDataHora(card.limite_saida, req.body.addHour);

							} else {
								// console.log('O tempo de saída é superior a tolerencia');
							}
						}


						card.pagamento = pagamento;

						console.log(card);

						if(card.permanencia)
							card.permanencia = helper.formataHora(card.permanencia);

						res.json(card);

					} else {
						res.json({err: 1, message: 'Nenhuma tabela de preço padrão ativa.'});
					}

				});

			}
		});
	}		
};

Controller.confirmPayment = function() {
	return function(req, res, next) {
		console.log('Controller.confirmPayment = function() {');
		console.log('IP: '+helper.getIp(req));

		Equipamento.findOne({tipo: 'Pagamento', ip: helper.getIp(req) }, function(err, equipamento) {
			if(err || !equipamento) {
				console.log('Este equipamento não possui permissão para realizar pagamentos.');
				res.json({err: 1, message: 'Este equipamento não possui permissão para realizar pagamentos.'});
			} else {
				Cartao.findOne({codigos: req.body.codigo, 'excluido.data_hora': null}, function(err, result) {
					var upsert = false;

					if(!result) {
						var pattern = helper.decodeBarcode(req.body.codigo);
						upsert = true;
						result = {
							_id: new mongoose.Types.ObjectId(),
							tipo: 'Permanência',
							nome: req.body.codigo,
							sempre_liberado: false,
							data_inicio: moment(pattern.dia+'/'+pattern.mes+'/'+pattern.ano+' '+pattern.hora+':'+pattern.minuto, 'DD/MM/YYYY HH:mm').toISOString(),
							pagamento: [],
							codigos: [req.body.codigo],
			               	ticket: {
									linha1: req.session.configuracao.ticket.linha1 || '',
									linha2: req.session.configuracao.ticket.linha2 || '',
									linha3: req.session.configuracao.ticket.linha3 || '',
									linha4: req.session.configuracao.ticket.linha4 || '',
									linha5: req.session.configuracao.ticket.linha5 || '',
									//linha6: req.session.configuracao.ticket.linha6
							}
						};
					} else
						result = result.toObject();

					result.liberado = true;
					result.limite_saida = moment(req.body.ticketData.limite_saida, 'DD/MM/YYYY HH:mm').toISOString();

					console.log('++++++++++++++++++++++++++++ recebendo o payment no confirmPayment');

					var pagamento = {
						_id: new mongoose.Types.ObjectId(),
						_cliente: null,
						_cartao: result._id,
						_caixa: null,
						_usuario: null,
						_equipamento: equipamento._id,
						codigos: req.body.codigo,
						nome: 'Pagamento de Ticket',
						data_registro: new Date(),
						data_pagamento: new Date(),
						data_vencimento: new Date(),
						tipo: 'Permanência',
						pago: true,
						total: req.body.ticketData.pagamento.total,
						valor: req.body.ticketData.pagamento.total,
						valor_recebido: req.body.ticketData.pagamento.total,
						troco: '0,00',
						forma_pagamento: req.body.forma_pagamento,
						operador: null,
						tabela: req.body.ticketData.pagamento.tabela,
						data_hora: new Date(),
						tef: {
							rede_adiquirente: req.body.rede_adiquirente,
							transacao: req.body.transacao,
							autorizacao: req.body.autorizacao,
							mensagem_operador: req.body.mensagem_operador,
							codigo_controle: req.body.codigo_controle,
							numero_cartao: req.body.numero_cartao,
							nome_cartao: req.body.nome_cartao,
							numero_terminal: req.body.numero_terminal,
							tipo_cartao: req.body.tipo_cartao,
							tipo_pagamento: req.body.tipo_pagamento,
						}
					};
					
					if(!result.pagamento) 
						result.pagamento = [];
					result.pagamento.push(pagamento);		

					console.log('exibindo o result: (cartao)');
					console.log(result);

					var	pagamentoItem = new Pagamento(pagamento);
					pagamentoItem.save(function(err) {
						Cartao.findOneAndUpdate({_id: result._id}, result, {upsert: upsert}, function (err) {
							if(!err) {
								// gera a nota fiscal
								console.log('SUCESSO ACABOU, É TÉÉÉÉTRA.');
								res.json({err: false, message: 'Pagamento realizado<br />Retire seu comprovante'});
							} else {
								console.log(err);
								console.log('DEU RUIM');
								res.json({err: 1, message: 'Ocorreu um erro interno, tente novamente.'});
							}
						});
					});

				});
			}
		});
	}
}

// expose this inherited controller
module.exports = Controller;
=======
'use strict';
// alteracao exibindo a msg de tolerancia
// problema pinpad operacao cancelada // em CC visa
// 
*/
var moment 	 = require('moment');
var helper 	 = require('../config/helper');
var config 	 = require('../config');
var mongoose = require('mongoose');

var Cartao 			= require('../models/cartao'),
	TabelaDePreco 	= require('../models/tabela-preco'),
	Equipamento 	= require('../models/equipamento'),
	Pagamento 		= require('../models/pagamento'),
	Configuracao 	= require('../models/configuracao'),
	Diaria			= require('../models/diaria'),
	CaixaController = require('../controllers/caixa'),
	gerenciador 	= require('../controllers/gerenciador-de-tabela');

var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'api',
	menu			: '',
	pageName		: '',
	pageNamePlural	: '',
	model 			: 'cartao'
});

Controller.customRoutes = function(app) {
	 app.post('/'+this.route+'/barcode/find', this.find())
	 	.post('/'+this.route+'/totem/confirmar-pagamento', this.confirmPayment())
	 	.get('/'+this.route+'/pagamento/:codigo', this.printPagamento())
};

Controller.printPagamento = function() {
	return function(req, res, next) {
		console.log('printPagamento');
		req.options = config.app();
		req.options.layout = 'print';

		if(req.query.printComPopup)
			req.options.printComPopup = true;
		
		console.log('Procurando o cartao com o codigo '+req.params.codigo);

		req.options.configuracao = req.session.configuracao;
		req.options.config = req.session.configuracao;

		Cartao.findOne({codigos: req.params.codigo}, function(err, result) {
			// console.log(result)
			
			if(!err && result) {
				console.log('Cartao encontrado, preparando impressao');
				var pattern = helper.decodeBarcode(req.params.codigo);
				if(pattern) {
					result = result.toObject();
					result.code = result.codigos[0];
					result.data = pattern.dia+'/'+pattern.mes;
					result.hora = pattern.hora+':'+pattern.minuto+':'+pattern.segundo;
				} 

	  	  		req.options.result = result;

				//res.render('ticket/pagamento', req.options, function(err, html) {
				//	res.json({html: html});
				//});


				res.render('ticket/pagamento', req.options);



			} else {
				console.log('Pagamento não encontrado');
				res.json({err: 1, message: 'Pagamento não encontrado'});
			}
		});
	};
};

Controller.find = function () {
	var options = config.app(),
		self = this;
		
		return function (req, res, next) {
			console.log('CHEGOU AQUI');
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
											gerenciador.findTable(new Date(), (card.convenio && card.convenio._gerenciador)? card.convenio._gerenciador : req.body.id_gerenciador, card, function (result) {
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
															
															card.permanencia	=	helper.diferencaData(moment(), (hora_inicial && (!card.convenio || (card.convenio && card.convenio._gerenciador))) ? hora_inicial : card.data_inicio);
															var permanencia		=	card.permanencia;
															// adiciona o valor a ser vendido com a opcao Vender Horas
															if (req.body.addHour) {
																permanencia = helper.somaHora(permanencia, req.body.addHour);
																card.addHourDEBUG = helper.formataHora(req.body.addHour);
															}

															card.permanenciaDEBUG = helper.formataHora(permanencia);

															// verifica se esta dentro da tolerancia de entrada
															var timeStampPermanencia = moment(permanencia, 'HH:mm').valueOf();
															var timeStampTolerancia = moment(priceTable.tolerancia_entrada, 'HH:mm').valueOf();

															if (timeStampPermanencia < timeStampTolerancia && priceTable.tolerancia_entrada !== '00:00' && priceTable.tolerancia_entrada !== 'undefined') {
																var tempoRestanteSaida = helper.diferencaHora(priceTable.tolerancia_entrada, permanencia);
																card.tolerancia = true;
																// falta exibir quanto tempo para saida
																// no checkout exibir os pagamentos
																card.message = 'Ticket dentro do periodo de tolerância, restam <b>' + tempoRestanteSaida + '</b> para saída.';
																card.err = false;
															} else

																if (priceTable && !card.tolerancia) {
																	var result = self.calculaPrecoTabela(permanencia, priceTable);
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
																		pagamento.tabela.hora = result.hora;
																	}
																}


															card.status = 'success';
															pagamento.tabela._id = priceTable._id;
															pagamento.tabela.nome = priceTable.nome;

															// calcula o horario para saida somando o horario inicial com a quantidade paga de horas

															card.limite_saida = (hora_inicial && !card.convenio) ? helper.somaDataHora(moment(hora_inicial, 'DD/MM/YYYY HH:mm').format('DD/MM/YYYY HH:mm'), pagamento.tabela.hora) : helper.somaDataHora(card.data_inicio, pagamento.tabela.hora);


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
															
															console.log('===============================================================')
															console.log('IMPRIMINDO TICKET')
															console.log(card)

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

Controller.confirmPayment = function() {
	return function(req, res, next) {
		console.log('Controller.confirmPayment = function() {');
		console.log('IP: '+helper.getIp(req));

		Equipamento.findOne({tipo: 'Pagamento', ip: helper.getIp(req) /*$or:[{ip: ip}, {mac: mac}]*/}, function(err, equipamento) {
			if(err || !equipamento) {
				console.log('Este equipamento não possui permissão para realizar pagamentos.');
				res.json({err: 1, message: 'Este equipamento não possui permissão para realizar pagamentos.'});
			} else {
				Cartao.findOne({codigos: req.body.codigo, 'excluido.data_hora': null}, function(err, result) {
					var upsert = false;

					if(!result) {
						var pattern = helper.decodeBarcode(req.body.codigo);
						upsert = true;
						result = {
							_id: new mongoose.Types.ObjectId(),
							tipo: 'Permanência',
							nome: req.body.codigo,
							sempre_liberado: false,
							data_inicio: moment(pattern.dia+'/'+pattern.mes+'/'+pattern.ano+' '+pattern.hora+':'+pattern.minuto, 'DD/MM/YYYY HH:mm').toISOString(),
							pagamento: [],
							codigos: [req.body.codigo],
			               	ticket: {
									linha1: req.session.configuracao.ticket.linha1 || '',
									linha2: req.session.configuracao.ticket.linha2 || '',
									linha3: req.session.configuracao.ticket.linha3 || '',
									linha4: req.session.configuracao.ticket.linha4 || '',
									linha5: req.session.configuracao.ticket.linha5 || '',
									//linha6: req.session.configuracao.ticket.linha6
							}
						};
					} else
						result = result.toObject();

					result.liberado = true;
					result.limite_saida = moment(req.body.ticketData.limite_saida, 'DD/MM/YYYY HH:mm').toISOString();

					console.log('++++++++++++++++++++++++++++ recebendo o payment no confirmPayment');

					var pagamento = {
						_id: new mongoose.Types.ObjectId(),
						_cliente: null,
						_cartao: result._id,
						_caixa: null,
						_usuario: null,
						_equipamento: equipamento._id,
						codigos: req.body.codigo,
						nome: 'Pagamento de Ticket',
						data_registro: new Date(),
						data_pagamento: new Date(),
						data_vencimento: new Date(),
						tipo: 'Permanência',
						pago: true,
						total: req.body.ticketData.pagamento.total,
						valor: req.body.ticketData.pagamento.total,
						valor_recebido: req.body.ticketData.pagamento.total,
						troco: '0,00',
						forma_pagamento: "Cartão de Débito",
						operador: null,
						tabela: req.body.ticketData.pagamento.tabela,
						data_hora: new Date(),
						tef: {
							rede_adiquirente: req.body.rede_adiquirente,
							transacao: req.body.transacao,
							autorizacao: req.body.autorizacao,
							mensagem_operador: req.body.mensagem_operador,
							codigo_controle: req.body.codigo_controle,
							numero_cartao: req.body.numero_cartao,
							nome_cartao: req.body.nome_cartao,
							numero_terminal: req.body.numero_terminal,
							tipo_cartao: req.body.tipo_cartao,
							tipo_pagamento: req.body.tipo_pagamento,
						}
					};
					
					if(!result.pagamento) 
						result.pagamento = [];
					result.pagamento.push(pagamento);		

					console.log('exibindo o result: (cartao)');
					console.log(result);

					var	pagamentoItem = new Pagamento(pagamento);
					pagamentoItem.save(function(err) {
						Cartao.findOneAndUpdate({_id: result._id}, result, {upsert: upsert}, function (err) {
							if(!err) {
								res.json({err: false, message: 'Pagamento realizado<br />Retire seu comprovante'});
							} else {
								console.log(err);
								console.log('DEU RUIM');
								res.json({err: 1, message: 'Ocorreu um erro interno, tente novamente.'});
							}
						});
					});

				});
			}
		});
	}
}

// expose this inherited controller
module.exports = Controller;