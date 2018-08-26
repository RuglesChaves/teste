'use strict';

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'configuracao',
	menu			: 'Configuração',
	pageName		: 'Sistema',
	pageNamePlural	: 'Sistema',
	model  			: 'configuracao'
});

// override default methods
Controller.read = function() {
	var Model 	= require('../models/configuracao'),
		self	= this;

	return function(req, res, next) {
		req.options.isEdit = true;
		req.options.action = 'Alterar';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb = [
			{ 
			  'route': '/inicio',
			  'pageName': 'Início'
			},
			{ 'route': '/'+self.route,
			  'pageName': self.pageName }
		];

		Model.findOne({}, function(err, result) {
			if(result){
				if(typeof result.app.validar_cpf_cnpj_duplicados === 'undefined')
					result.app.validar_cpf_cnpj_duplicados = false;
				if(typeof result.app.validar_cpf_cnpj === 'undefined')
					result.app.validar_cpf_cnpj = true;

				req.options.result = result;
			}
				
			res.render(req.options.route + '/show', req.options);
		});
	};
};

Controller.create = function() {

	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
		console.log('x1md');

		Model.findOne({}, function(err, configuracao) {

			// para que venha esse req.file populado é preciso adicionar na rota do create um middleware  upload.single('file'), onde esse file é o atributo name do input file que vira pelo req - o modulo multer é o responsavel por isso, ele é necessario pois o bodyParser do express não trata requisições multipart-form-data, somente trata url-encoded, o multer que trata form-data
			console.log('req.files');
			console.log(req.files);

			if(req.file && req.file.buffer && req.file.mimetype) {
				req.body.empresa.logo = {
					data: req.file.buffer,
					contentType: req.file.mimetype
				}
			} else {
				// isso aqui é feito pra nao perder o logo ja salvo caso o form tenha sido submetido sem um logo, na funcao update ele troca o objeto ja salvo no banco pelo objeto vindo do req.body 
				req.body.empresa.logo = configuracao.empresa.logo;
			}

			req.body.app.backup = configuracao.app.backup;

			Model.findOneAndUpdate({}, {$set: req.body}, {upsert: false}, function(err, newDocument) {
				if(err)
					res.json({err: 1, message: 'Não foi possível realizar a operação.'});
				else {
					// console.log(newDocument)
					req.session.configuracao = newDocument;
					self.logUsuario(req, 'update', configuracao, newDocument);
					res.json({err: 0, message: 'Operação realizada com sucesso.'});
				}
				
			});

		});

	};
};

// expose this inherited controller
module.exports = Controller;
