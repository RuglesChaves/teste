'use strict';
var helper = require('../config/helper');
var mongoose = require('mongoose');
var moment = require('moment');

// require default controller
var controller = require('../controllers/controller');

//require models
var TabelaPrecos = require('../models/tabela-preco'),
	GerenciadorDeTabelas = require('../models/gerenciador-de-tabela'),
	Feriado = require('../models/feriado');

// creating a new controller object
var Controller = new controller({
	route: 'gerenciador-de-tabela',
	menu: 'Cadastros',
	pageName: 'Gerenciador de Tabelas',
	pageNamePlural: 'Gerenciador de Tabelas',
	model: 'gerenciador-de-tabela'
});

// uma função que receba um tipo e uma data, e a partir dai escolher a tabela correta

Controller.findTable = function (dia, id_gerenciador, card, callback) {
	var diaDaSemanaCard = '',
		diaDaSemana = '',
		isFeriado = false,
		resposta = { tabela: 'usar-tabela-padrão' },
		configs = [],
		filter = {};

	if (typeof id_gerenciador !== 'undefined') {
		filter._id = id_gerenciador
	} else {
		filter.padrao = true;
		filter.ativo = true;
	}

	//verificando o dia da semana do cartão
	if (typeof card !== 'undefined') {
		switch (moment(card.data_inicio, 'DD/MM/YYYY HH:mm').isoWeekday()) {
			case 0:
				diaDaSemanaCard = 'Domingo';
				break;
			case 1:
				diaDaSemanaCard = 'Segunda-Feira';
				break;
			case 2:
				diaDaSemanaCard = 'Terça-Feira';
				break;
			case 3:
				diaDaSemanaCard = 'Quarta-Feira';
				break;
			case 4:
				diaDaSemanaCard = 'Quinta-Feira';
				break;
			case 5:
				diaDaSemanaCard = 'Sexta-Feira';
				break;
			case 6:
				diaDaSemanaCard = 'Sábado';
				break;
		}
	}
	//Verificando o dia da semana
	switch (moment(dia).isoWeekday()) {
		case 0:
			diaDaSemana = 'Domingo';
			break;
		case 1:
			diaDaSemana = 'Segunda-Feira';
			break;
		case 2:
			diaDaSemana = 'Terça-Feira';
			break;
		case 3:
			diaDaSemana = 'Quarta-Feira';
			break;
		case 4:
			diaDaSemana = 'Quinta-Feira';
			break;
		case 5:
			diaDaSemana = 'Sexta-Feira';
			break;
		case 6:
			diaDaSemana = 'Sábado';
			break;
	}

	Feriado.find({}, function (err, feriados) {
		if (!err) {
			GerenciadorDeTabelas.findOne(filter, function (err, gerenciador) {
				if (!err && gerenciador) {
					// console.log(gerenciador.nome);
					resposta.gerenciador = gerenciador;

					if (feriados) {
						//detectando a data correta para descobrir se é feriado conforme o gerenciador de tabelas
						const diaDaData = gerenciador['validar-por'] === 'Saída' ? moment(dia).get('date') : moment(card.data_inicio, 'DD/MM/YYYY HH:mm').get('date');
						const mesDaData = gerenciador['validar-por'] === 'Saída' ? moment(dia).get('month') : moment(card.data_inicio, 'DD/MM/YYYY HH:mm').get('month');
						const anoDaData = gerenciador['validar-por'] === 'Saída' ? moment(dia).get('year') : moment(card.data_inicio, 'DD/MM/YYYY HH:mm').get('year');

						for (const feriado of feriados) {
							//se o feriado repetir todos os anos, o algoritimo compara apenas dia e mês
							if (feriado['repetir-todo-ano']) {
								if ((diaDaData === moment(feriado['data-feriado']).get('date'))
									&& (mesDaData === moment(feriado['data-feriado']).get('month'))) {
									console.log('é feriado repetindo o ano todo');	
									console.log(feriado.nome);
									isFeriado = true;
									break;
								}
							} else {
								//se o feriado não repete todos os anos o algoritimo compara dia,mês e ano
								if ((diaDaData === moment(feriado['data-feriado']).get('date'))
									&& (mesDaData === moment(feriado['data-feriado']).get('month'))
									&& (anoDaData === moment(feriado['data-feriado']).get('year'))) {
									console.log('é feriado apenas hoje');
									console.log(feriado.nome);
									isFeriado = true;
									break;
								}
							}
						}
					}

					if (isFeriado) {
						//Caturando os horários em configs para feriado
						for (var config of gerenciador.configs) {
							if (config.dias.indexOf('Feriado') > -1) {
								configs.push(config);
							}
						}
					}

					if (configs.length === 0) {
						//Capturando os horários em configs pelo dia da semana.
						//Caso seja feriado, porém não tenha configurações para feriado, utilize uma configuração no dia da semana.
						for (var config of gerenciador.configs) {
							//Caso o configurador seja de uma Saída é pego as configurações da variável diaDaSemada que é o horário atual
							//Agora se o configurador seja de uma Entrada é pego as configurações da variável diaDaSemanaCard que é o horário de entrada do ticket
							if (config.dias.indexOf(gerenciador['validar-por'] === 'Saída' ? diaDaSemana : diaDaSemanaCard) > -1) {
								configs.push(config);
							}
						}
					}

					if (configs.length > 0) {
						if (gerenciador['validar-por'] === 'Saída') {
							for (const config of configs) {
								//Analizando se a hora de saída está detro do período de uma config
								if (helper.horaMinutoParaInteiro(config.hora_inicio) <= helper.horaMinutoParaInteiro(moment(dia).hour() + ":" + helper.pad(moment(dia).minute()))
									&& helper.horaMinutoParaInteiro(config.hora_fim) >= helper.horaMinutoParaInteiro(moment(dia).hour() + ":" + helper.pad(moment(dia).minute()))) {
									resposta.tabela = config._tabela;
									//Caso essa config tenha um zerar permanência, o horário de cobrança será alterado para o da hora de inicio
									//dessa config

									if(config.zerar_permanencia && moment(card.data_inicio, 'DD/MM/YYYY HH:mm').unix() <= moment().hour(Number(config.hora_inicio.slice(0,2))).minute(config.hora_inicio.slice(3)).unix()){
										resposta['horario-cobrado'] = moment().hour(Number(config.hora_inicio.slice(0,2))).minute(config.hora_inicio.slice(3));
										break;
									}
								}

								if (config.zerar_permanencia) {
									if(moment(card.data_inicio, 'DD/MM/YYYY HH:mm').unix() <= moment().hour(Number(config.hora_inicio.slice(0,2))).minute(config.hora_inicio.slice(3)).unix()
									&& moment().hour(Number(config.hora_fim.slice(0,2))).minute(config.hora_fim.slice(3)).unix() <= moment(dia).unix()){
										if(!resposta['horario-cobrado'])
											resposta['horario-cobrado'] = moment().hour(Number(config.hora_inicio.slice(0,2))).minute(config.hora_inicio.slice(3));
										else
											if(helper.horaMinutoParaInteiro(resposta['horario-cobrado']) < helper.horaMinutoParaInteiro(config.hora_inicio))
												resposta['horario-cobrado'] = moment().hour(Number(config.hora_inicio.slice(0,2))).minute(config.hora_inicio.slice(3));

									}
								}
								
							}
							if(resposta.tabela !== 'usar-tabela-padrão'){
								return callback(resposta);
							}
							return;
						} else {
							for (const config of configs) {
								if (helper.horaMinutoParaInteiro(config.hora_inicio) <= helper.horaMinutoParaInteiro(moment(card.data_inicio, 'DD/MM/YYYY HH:mm').hour() + ":" + helper.pad(moment(card.data_inicio, 'DD/MM/YYYY HH:mm').minute()))
									&& helper.horaMinutoParaInteiro(config.hora_fim) >= helper.horaMinutoParaInteiro(moment(card.data_inicio, 'DD/MM/YYYY HH:mm').hour() + ":" + helper.pad(moment(card.data_inicio, 'DD/MM/YYYY HH:mm').minute()))) {
									resposta.tabela = config._tabela;
									callback(resposta);
									return;
								}
							}
						}
					} else {
						console.log('Não existe uma configuração cadastrada para este dia');
						return;
					}

				} else {
					//caso não exista um gerenciador de tabelas ativo e padrão
					callback(resposta);
					console.log('Não foram encontrados gerenciadores, ou erro interno do servidor');
					return;
				}
			});

		} else {
			console.log('Erro ocorrido durante a busca por feriados');
			return;
		}

	});
}

Controller.read = function() {
	var self	= this;

	return function(req, res, next) {
		var page = req.query.page || 1;
		GerenciadorDeTabelas.paginate({}, {page: page, limit: 25, sort: {$natural: -1}, populate: '_usuario' }, function(err, result) {
			if(!err && result) {
				req.options.result = result.docs;
				
				req.options.total = Number(result.total);
				req.options.limit = Number(result.limit);
				req.options.page = Number(result.page);
				req.options.pages = Number(result.pages);

				req.options.pagination = helper.pagination(req.options);
			}
			res.render(self.route, req.options);
		});
	};
}

Controller.new = function () {
	var self = this;

	return function (req, res, next) {

		TabelaPrecos.find({ ativo: true, tipo: 'Permanência' }, function (err, tabelas) {
			if (!err, tabelas) {
				req.options.tabelas = tabelas;
				res.render(self.route + '/show', req.options);
			} else {
				res.json({ err: 1, message: 'Não foi possível realizar a operação.<br />' + err });
			}
		});

	}

}

Controller.edit = function () {
	var Model = require('../models/' + this.model),
		self = this;

	return function (req, res, next) {
		req.options.isEdit = true;
		req.options.action = 'Alterar';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb.push({
			route: '/' + self.route + '/' + req.params.id,
			pageName: req.options.title
		});

		Model.findOne({ _id: req.params.id }, function (err, result) {
			if (err || !result) {
				req.flash('error', 'Registro não encontrado.');
				res.redirect('/' + self.route);
			} else {
				req.options.result = result;
				TabelaPrecos.find({ ativo: true, tipo: 'Permanência' }, function (err, tabelas) {
					if (!err && tabelas)
						req.options.tabelas = tabelas;
					res.render(self.route + '/show', req.options);
				});
			}
		});
	};
}

Controller.create = function () {
	var Model = require('../models/' + this.model),
		self = this;

	return function (req, res, next) {

		req.body._usuario = req.session.login._id;
		req.body['ultima-atualizacao'] = new Date(); //tem alguma coisa do mongoose?

		var newDocument = new Model(req.body);

		newDocument.save(function (err) {
			if (err)
				res.json({ err: 1, message: 'Não foi possível realizar a operação.<br />' + err });
			else {
				if (req.body.padrao === 'true') {
					// quando o gerenciador de tabelas é marcado como padrão, os outros devem ser atualizados para padrão false
					Model.update({ _id: { $ne: newDocument._id } }, { $set: { padrao: false } }, { multi: true }, function (err) {
					});
				}
				self.logUsuario(req, 'create', null, newDocument);
				res.json({ err: 0, redirect: '/' + self.route });
			}
		});
	};
}

Controller.update = function () {
	var Model = require('../models/' + this.model),
		self = this;
	return function (req, res, next) {

		Model.findOne({ _id: req.body.id }, function (err, oldDocument) {
			if (err || !oldDocument) {
				res.json({ err: 1, message: 'Não foi possível realizar a operação.<br />Registro não encontrado.' });
			} else {
				req.body._usuario = req.session.login._id;
				req.body['ultima-atualizacao'] = new Date();

				Model.findOneAndUpdate({ _id: req.body.id }, req.body, function (err, newDocument) {
					if (err || !newDocument)
						res.json({ err: 1, message: 'Não foi possível realizar a operação.<br />' + err });
					else {
						if (req.body.padrao === 'true') {
							// quando o gerenciador de tabelas é marcado como padrão, os outros devem ser atualizados para padrão false
							Model.update({ _id: { $ne: newDocument._id } }, { $set: { padrao: false } }, { multi: true }, function (err) {
							});
						}
						self.logUsuario(req, 'update', oldDocument, newDocument);
						res.json({ err: 0, redirect: '/' + self.route });
					}
				});
			}
		});
	};
}


module.exports = Controller;