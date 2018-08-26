'use strict';

var upload		 = require('multer')(),
	config 		 = require('../config'),
	helper 		 = require('../config/helper'),
	LogUsuario	 = require('../models/log-usuario');

var Controller = function(options) {
	this.route 			= options.route;
	this.menu			= options.menu;
	this.pageName 		= options.pageName;
	this.pageNamePlural = options.pageNamePlural;
	this.model 			= options.model;
};

Controller.prototype = {
	showNotification: function(app) {
	},
	addRoutes: function(app) {
		// antes de entrar de fato na funcao da rota passa por 3 middlewares
		// autentication verifica se está logado
		// permission verifica se tem permissao para acessar a rota
		// validation por hora so serve para poder levar override no controller filho
		// default carrega as opções padrões que serão enviadas para a view

		app.post('/'+this.route, this.autentication(), this.permission('new'), this.validation('create'), upload.single('file'), this.create())

		   .get('/'+this.route, this.autentication(), this.permission('read'), this.validation('read'), this.default(), this.read())

		   .put('/'+this.route, this.autentication(), this.permission('edit'), this.validation('update'), this.update())

		   .delete('/'+this.route+'/:id', this.autentication(), this.permission('delete'), this.validation('delete'), this.delete())

		   .get('/'+this.route+'/cadastrar', this.autentication(), this.permission('new'), this.validation('new'), this.default(), this.new())

  		   .get('/'+this.route+'/print/:id', this.autentication(), this.default(), this.print())

		   .get('/'+this.route+'/print/*', this.autentication(), this.default(), this.print())

		   .get('/'+this.route+'/:id', this.autentication(), this.permission('edit'), this.validation('edit'), this.default(), this.edit());
	},
	autentication: function() {
		return function(req, res, next) {
			// console.log('autentication');
			if(req.session.login)
				next();
			else {
				req.session.redirect = req.url;
				req.flash('error','Sessão expirada, faça login novamente.');
				if(req.route && req.route.methods.get === true)
					res.redirect('/');
				else
	  				res.json({err: 1, redirect: '/'});
	  		}
		};
	},
	permission: function(resource) {
		var self = this;

		return function(req, res, next) {
			// console.log('permission');
			var permissao = req.session.login._nivel_acesso.permissao;

			if(permissao.inicio)
				permissao.inicio.push('read');
			else
				permissao.inicio = ['read'];

			if(permissao[self.route] && permissao[self.route].indexOf(resource) > -1)
				return next();

			var err = new Error('Você não tem permissão para realizar esta operação.');
			err.status = 203; // não autorizado	
			next(err);
		};
	},
	validation: function(resource) { // utilize o model para fazer um override nesse metodo e customizar a validação
		return function(req, res, next) {
			// console.log('validation +'+resource);
			next();
		};
	},
	logUsuario: function(req, functionName, registroAntigo, registroNovo, callback) {
		registroAntigo = registroAntigo && typeof registroAntigo.toObject === 'function' ? registroAntigo.toObject() : {};
		registroNovo = registroNovo && typeof registroNovo.toObject === 'function' ? registroNovo.toObject() : {};

		var diff = helper.deepDiffMapper.map(registroAntigo, registroNovo);

		if(typeof diff === 'object' && Object.keys(diff).length) {

			var self = this,
				acao, descricao, descricaoDetalhada;

			if(!callback) callback = function() {};

			switch(functionName) {
				case 'delete':  acao = 'excluiu'; break;
				case 'create': 	acao = 'cadastrou'; break;
				case 'update':  acao = 'alterou'; break;
				case 'restore': acao = 'restaurou'; break;
				default: 	    acao = functionName;
			}

			descricao = req.session.login.nome + ' ' + acao + ' o '+ self.pageName;
			
			if(registroAntigo && registroAntigo.nome) 
				descricao += ' '+registroAntigo.nome;
			else if(registroNovo && registroNovo.nome) 
				descricao += ' '+registroNovo.nome;
			else if(registroAntigo && registroAntigo.codigos) 
				descricao += ' '+registroAntigo.codigos;
			else if(registroNovo && registroNovo.codigos) 
				descricao += ' '+registroNovo.codigos;

			descricao += ' através do';

			if(req.session.terminal && req.session.terminal.nome) 
				descricao += ' terminal '+req.session.terminal.nome;
			
			if(req.session.ip)
				descricao += ' ip '+req.session.ip;
			
			descricaoDetalhada = JSON.stringify(diff, helper.replacer, ' ');
			descricaoDetalhada = descricaoDetalhada.replace('{','').replace('}','').replace(/"/g,'');
			descricaoDetalhada = descricaoDetalhada.replace(/{/g,'<div class="log-margin-left">');
			descricaoDetalhada = descricaoDetalhada.replace(/}/g,'</div>');
			descricaoDetalhada = descricaoDetalhada.replace(/\n/g,'<br />');
			
			new LogUsuario({
				_usuario: req.session ? req.session.login._id : null,
				_terminal: req.session.terminal ? req.session.terminal._id : null,
				_objeto: registroAntigo ? registroAntigo._id : registroNovo._id,
				model: self.model,
				route: req.headers.referer ? req.headers.referer : self.route,
				method: req.route ? Object.keys(req.route.methods)[0] : '',
				'user-agent': req.headers['user-agent'],
				'page-name': self.pageName,
				function: functionName,
				descricao: descricao,
				descricao_detalhada: descricaoDetalhada,
				registro_antigo: JSON.stringify(registroAntigo),
				registro_novo: JSON.stringify(registroNovo),
				ip: req.session.ip
			}).save(function(err) {
				if(err) 
					callback(err, 'Não foi possível registrar a ação no log do sistema');
				else 
					callback(err, 'Ação registrada no log do sistema.');
		    });
		}
	},
	default: function()  {
		var self = this;

		return function(req, res, next) {
			// console.log('default');

			req.options = config.app();
			req.options.ip = req.session.ip;
			req.options.route = self.route;
			// req.options.operador = req.session.login.nome;
			req.options.menu = self.menu;
			req.options.title = self.pageNamePlural;
			req.options.breadCrumb = [
				{ 
				  'route': '/inicio',
				  'pageName': 'Início'
				},
				{ 
				  'route': '/'+self.route,
				  'pageName': req.options.title 
				}
			];
			req.options.permission = req.session.login._nivel_acesso.permissao;
			req.options.flash = req.flash();
			req.options.session = req.session;
			req.options.query = req.query;
			req.options.estados = helper.getEstados();
			req.options.login = {
				nome: req.session.login.nome
			};
			req.options.configuracao = req.session.configuracao;
			req.options.config = req.session.configuracao;
			req.options.caixa = req.session.caixa;
			req.options.terminal = req.session.terminal;

			next();
		};
	},
	read: function() {
		var Model  = require('../models/'+this.model),
			self   = this;

		return function(req, res, next) {
			var page = req.query.page || 1;
			Model.paginate({}, {page: page, limit: 25, sort: {$natural: -1}}, function(err, result) {
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
	},
	new: function() {
		var self = this;

		return function(req, res, next) {
			req.options.isEdit = false;
			req.options.action = 'Cadastrar';
			req.options.title = req.options.action + ' ' + self.pageName;
			req.options.breadCrumb.push({ 
				'route': '/'+self.route+'/cadastrar',
				'pageName': req.options.title });
			res.render(self.route + '/show', req.options);
		};
	},
	edit: function() {
		var Model = require('../models/'+this.model),
			self  = this;

		return function(req, res, next) {
			req.options.isEdit = true;
			req.options.action = 'Alterar';
			req.options.title = req.options.action + ' ' + self.pageName;
			req.options.breadCrumb.push({ 
				route: '/'+self.route+'/'+req.params.id,
				pageName: req.options.title
			});
			
			Model.findOne({_id: req.params.id}, function(err, result) {
				if(err || !result) {
					req.flash('error','Registro não encontrado.');
					res.redirect('/'+self.route);
				} else {
		  	  		req.options.result = result;
					res.render(self.route + '/show', req.options);
			  	}
			});
		};
	},
	create: function() {
		var Model = require('../models/'+this.model),
			self  = this;

		return function(req, res, next) {
	    	var	newDocument = new Model(req.body);
		    newDocument.save(function(err) {
				if(err)
					res.json({err: 1, message: 'Não foi possível realizar a operação.<br />' + err});
				else  {
					self.logUsuario(req, 'create', null, newDocument);
					res.json({err: 0, redirect: '/'+self.route});
				}
		    });
		};
	},
	update: function() {
		var Model = require('../models/'+this.model),
			self  = this;

		return function(req, res, next) {
			console.log(req.body);
			Model.findOne({_id: req.body.id}, function(err, oldDocument) {
				if(err || !oldDocument)
					res.json({err: 1, message: 'Não foi possível realizar a operação.<br />Registro não encontrado.'});
				else
					Model.findOneAndUpdate({_id: req.body.id}, req.body, function(err, newDocument) {
						if(err || !newDocument)
							res.json({err: 1, message: 'Não foi possível realizar a operação.<br />' + err});
						else {
							self.logUsuario(req, 'update', oldDocument, newDocument);
							res.json({err: 0, redirect: '/'+self.route});
						}
					});
			});
		};
	},
	delete: function() {
		var Model = require('../models/'+this.model),
			self = this;

		return function(req, res, next) {
			Model.findOneAndRemove({_id: req.params.id}, function(err, deletedDocument) {
				if(err || !deletedDocument)
					res.json({err: 1, message: 'Não foi possível realizar a operação.<br />' + err});
				else {
					self.logUsuario(req, 'delete', deletedDocument, null);

					if(req.body.redirect && req.body.redirect === 'true')
						res.json({err: 0, redirect: '/'+self.route});
					else
						res.json({err: 0, message: ''});
				}
			});
		};
	},
	print: function() {
		return function(req, res, next) {};
	}
};

module.exports = Controller;
