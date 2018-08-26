'use strict';
var helper			= require('../config/helper');
var mongoose		= require('mongoose');
var moment			= require('moment');
// require default controller
var controller		= require('../controllers/controller');
//require models
var Cartao			= require('../models/cartao');
var Convenio		= require('../models/convenio');
var Tabela			= require('../models/tabela-preco');
var Usuario			= require('../models/usuario');
var Gerenciador		= require('../models/gerenciador-de-tabela');
var Configuracao	= require('../models/configuracao');

// creating a new controller object
var Controller = new controller({
	route: 'convenio',
	menu: 'Cadastros',
	pageName: 'Convênio',
	pageNamePlural: 'Convênios',
	model: 'convenio'
});

Controller.customRoutes = function (app) {
	app.get('/convenio/atendimento', this.autentication(), this.default(), this.atendeConvenio());

	app.post('/convenio/atendimento/gerar-convenio', this.autentication(), this.permission('edit'), this.associar());
};

Controller.atendeConvenio = function () {
	var self = this;

	return function (req, res, next) {

		Convenio.find({ _usuario: req.session.login._id }).populate(['_tabelapreco', '_gerenciador']).exec(function (err, result) {
			req.options.convenios = result;
			req.options.have_type_gerenciador = false;
			req.options.have_type_tabela = false;

			for (const convenio of req.options.convenios) {
				if(convenio._gerenciador) 
					req.options.have_type_gerenciador = true;
				if(convenio._tabelapreco) 
					req.options.have_type_tabela = true;

				if(req.options.have_type_gerenciador && req.options.have_type_tabela )
					break;
			}
			res.render(self.route + '/atende', req.options);
		});

	}
};

Controller.associar = function() {

	return function (req, res, next) {
		
		Configuracao.findOne({}, function (errConfiguracao, resultConfiguracao) {
			Cartao.findOne({ codigos: req.body.codigo }, function (errCartao, resultCartao) {
				var upsert = false;

				if (errCartao || !resultCartao) {

					var pattern = helper.decodeBarcode(req.body.codigo);
					if (pattern && resultConfiguracao.app.entrada_offline) {
						upsert = true;
						resultCartao = {
							_id: new mongoose.Types.ObjectId(),
							tipo: 'Permanência',
							nome: req.body.codigo,
							sempre_liberado: false,
							liberado: false,
							data_inicio: moment(pattern.dia + '/' + pattern.mes + '/' + pattern.ano + ' ' + pattern.hora + ':' + pattern.minuto, 'DD/MM/YYYY HH:mm').toISOString(),
							codigos: [req.body.codigo],
							convenio: {}
						};
					} else {
						res.json({ err: 1, message: 'O código do ticket é inválido.' });
						return;
					}

				}

				if(req.body.convenios === 'tabelas'){
					Tabela.findOne({ _id: req.body.opcao }, function (errTabela, resultTabela) {
						if (!errTabela && resultTabela) {
							
							if (resultTabela.tipo === resultCartao.tipo) {

								if(resultCartao.convenio._gerenciador){
									resultCartao.convenio._gerenciador = null;
									resultCartao.convenio.nome_gerenciador = null;
								}
							
								resultCartao.convenio._usuario = req.session.login._id;
								resultCartao.convenio.nome_usuario = req.session.login.nome;
								resultCartao.convenio._tabelapreco = resultTabela._id;
								resultCartao.convenio.nome_tabela = resultTabela.nome;
								resultCartao.convenio._convenio = req.body.convenio;
								resultCartao.convenio.data_cadastro = new Date();
	
								Cartao.findOneAndUpdate({ _id: resultCartao._id }, resultCartao, { upsert: upsert }, function (err) {
									if (this.errCartao || !resultCartao) {
	
										res.json({ err: 1, message: 'Ticket não localizado.', withColorbox: 1});
	
									} else {
	
										res.json({ err: 0, message: 'Ticket conveniado com sucesso.', withColorbox: 1, XXXclear: 1});
	
									}
								})
	
							} else {
	
								res.json({ err: 1, message: 'Tabela de preço não permitida.', withColorbox: 1 });
							}
	
						} else {
							return res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.', withColorbox: 1 });
						}
	
					});
				}else if(req.body.convenios === 'gerenciadores'){
					Gerenciador.findOne({_id: req.body.opcao}, function(err, result){
						if (!err && result) {
							
							if (resultCartao.tipo === 'Permanência') {
								
								if(resultCartao.convenio._tabelapreco){
									resultCartao.convenio._tabelapreco = null;
									resultCartao.convenio.nome_tabela = null;
								}

								resultCartao.convenio._usuario = req.session.login._id;
								resultCartao.convenio.nome_usuario = req.session.login.nome;
								resultCartao.convenio._gerenciador = result._id;
								resultCartao.convenio.nome_gerenciador = result.nome;
								resultCartao.convenio._convenio = req.body.convenio;
								resultCartao.convenio.data_cadastro = new Date();
	
								Cartao.findOneAndUpdate({ _id: resultCartao._id }, resultCartao, { upsert: upsert }, function (err) {
									if (this.errCartao || !resultCartao) 
										res.json({ err: 1, message: 'Ticket não localizado.', withColorbox: 1 });
									else
										res.json({ err: 0, message: 'Ticket conveniado com sucesso.', withColorbox: 1, XXXclear: 1});
								})
	
							} else {
	
								res.json({ err: 1, message: 'Tabela de preço não permitida.', withColorbox: 1 });
							}
	
						} else {
							return res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.', withColorbox: 1 });
						}
					});
				}else
					return res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.', withColorbox: 1 });

			})

		});

	}

}

Controller.new = function () {
	var self = this;

	return function (req, res, next) {
		req.options.isEdit = false;
		req.options.action = 'Cadastrar';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb.push({
			'route': '/' + self.route + '/cadastrar',
			'pageName': req.options.title
		});

		Usuario.find({}, function (err, resultUsuarios) {
			Tabela.find({}, function (err, resultPrecos) {
				Gerenciador.find({}, function(err, resultGerenciadores){
					req.options.usuarios		= resultUsuarios;
					req.options.precos			= resultPrecos;
					req.options.gerenciadores	= resultGerenciadores;
					res.render(self.route + '/show', req.options);
				});
			});
		});
	};
};

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
				Tabela.find({}, function (err, resultPrecos) {
					Usuario.find({}, function (err, resultUsuarios) {
						Gerenciador.find({}, function(err, resultGerenciadores){
							req.options.precos			= resultPrecos
							req.options.usuarios		= resultUsuarios;
							req.options.gerenciadores	= resultGerenciadores;
							res.render(self.route + '/show', req.options);
						});
					});
				});
			}
		});
	};
};

Controller.create = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
		if (req.body._gerenciador && req.body._tabelapreco) {
			res.json({err: 1, message: 'Não é possível salvar convênios com tabelas e gerenciadores.'});
		} else {
			if(!req.body._gerenciador)
			req.body._gerenciador = null;
			if(!req.body._tabelapreco)
			req.body._tabelapreco = null;
			if(!req.body._usuario)
				req.body._usuario = null;

			req.body['atualizado-por'] = req.session.login.nome;
			req.body.cadastro = new Date();

			var	newDocument = new Model(req.body);
			newDocument.save(function(err) {
				if(err)
				res.json({err: 1, message: 'Não foi possível realizar a operação.<br />' + err});
				else  {
					self.logUsuario(req, 'create', null, newDocument);
					res.json({err: 0, redirect: '/'+self.route});
				}
			});
		}
	};
};

Controller.update = function() {
	var Model = require('../models/'+this.model),
	self  = this;
	
	return function(req, res, next) {
		if (req.body._gerenciador && req.body._tabelapreco) {
			res.json({err: 1, message: 'Não é possível salvar convênios com tabelas e gerenciadores.'});
		}else{
			Model.findOne({_id: req.body.id}, function(err, oldDocument) {
				if(err || !oldDocument)
					res.json({err: 1, message: 'Não foi possível realizar a operação.<br />Registro não encontrado.'});
				else{
					if(!req.body._gerenciador)
						req.body._gerenciador = null;
					if(!req.body._tabelapreco)
						req.body._tabelapreco = null;
					if(!req.body._usuario)
						req.body._usuario = null;

					req.body['atualizado-por'] = req.session.login.nome;
					req.body.cadastro = new Date();
					
					Model.findOneAndUpdate({_id: req.body.id}, req.body, function(err, newDocument) {
						if(err || !newDocument)
							res.json({err: 1, message: 'Não foi possível realizar a operação.<br />' + err});
						else {
							self.logUsuario(req, 'update', oldDocument, newDocument);
							res.json({err: 0, redirect: '/'+self.route});
						}
					});
				}
			});
		}
	};
};

// expose this inherited controller
module.exports = Controller;
