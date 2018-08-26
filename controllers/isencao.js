'use strict';

// require default controller
var controller = require('../controllers/controller');

//require models
var Isencao = require('../models/isencao');
var Cliente = require('../models/cliente');
var Usuario = require('../models/usuario');

//require config
var helper = require('../config/helper');

// creating a new controller object
var Controller = new controller({
    route: 'isencao',
    menu: '',
    pageName: '',
    pageNamePlural: '',
    model: 'isencao'
});

// override default methods


Controller.customRoutes = function (app) {
    app.post('/' + this.route + '/isentarMensalidade/:id', this.autentication(), this.isentarMensalidade())
       .get('/' + this.route + '/printIsencaoMensalista/:id', this.autentication(), this.default(), this.printIsencaoMensalista());
};

// expose this inherited controller


Controller.isentarMensalidade = function () {
    return function (req, res, next) {



        if (!req.body.code || !req.body.usuario || !req.body.senha || !req.body.pagamento || !req.body.bloqueio || !req.body.mensalidade) {
            return res.json({ err: 1, message: 'Preencha todos campos obrigatórios.' });
        }


        
        Cliente.findOne({codigos: req.body.code}, function(err, cliente) {
            if(err || !cliente) {
                res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.' });
            } else {
                Usuario.findOne({ _id: req.body.usuario, senha: req.body.senha }).populate('_nivel_acesso').exec(function (err, result) {
                    if (err || !result) {
                        res.json({ err: 1, message: 'Senha inválida' });
                    } else {
                        //console.log(result);
                        
                        if (result._nivel_acesso.permissao.pagamento.indexOf('exemption') !== -1) {
                            var isencao = new Isencao({
                                _usuario: req.session.login._id,
                                _usuario_autorizador: req.body.usuario,
                                _terminal: req.session.terminal._id,
                                _caixa: req.session.caixa._id,
                                _cliente: cliente._id,
                                tipo: 'Mensalidade',
                                data_cadastro: new Date(),
                                valor: req.body.pagamento.total,
                                descricao: 'Isenção de mensalidade referente à ',
                                observacao: req.body.observacao
                            });


                            var separador = '';
                            var count = 1;
                                                       
                            for(var key in req.body.mensalidade) {
                                var data = key.split('/');
                                isencao.descricao += separador+helper.getNomeMes(data[1])+' de '+data[2];
                                count++;
                                separador = count === Object.keys(req.body.mensalidade).length ? ' e ' : ', ';
                            }

                            isencao.save(function (err) {
                                if (err) {
                                    res.json({ err: 1, message: 'Não foi possível realizar a operação.' });
                                } else {
                                        

                                    if (!cliente.mensalidade.historico)
                                        cliente.mensalidade.historico = [];

                                    for (var key in req.body.mensalidade) {
                                        if (req.body.mensalidade.hasOwnProperty(key)) {
                                            
                                            var data = key.split('/');
                                            cliente.mensalidade.historico.push({
                                                _isencao: isencao._id,
                                                mes: data[1],
                                                ano: data[2],
                                                dia_vencimento: data[0],
                                                isento: true,
                                                pago: req.body.bloqueio === 'true' ? false : true,
                                                atrasado: false,
                                                valor: req.body.mensalidade[key]
                                            });
                                        }
                                    }

                                    Cliente.findOneAndUpdate({ _id: cliente._id }, cliente, { 'new': true }, function (err, cliente) {
                                        if (!err && cliente) {
                                            helper.retornaMensalidades(cliente, function (err, cliente) {
                                                if (!err && cliente) {

                                                    
                                                    res.json({ err: 0, message: 'Isenção realizada com sucesso.', cliente: cliente, isencao: isencao, code: req.body.code });
                                                }

                                            });
                                        }
                                        else {
                                            res.json({ err: 1, message: 'Ocorreu um erro interno, tente novamente.' });
                                        }
                                    });
                                 

                                }
                            });

                        } else {
                            res.json({ err: 1, message: 'Nivel de acesso não permitido.' });
                        }

                    }

                });

            }
        });

    }
};

Controller.printIsencaoMensalista = function () {
	var self = this;

	return function (req, res, next) {
        req.options.layout = 'print';
        
        var populateFields = [
            {path: '_cliente'},
            {path: '_caixa'},
            {path: '_usuario'},
            {path: '_usuario_autorizador'},
            {path: '_terminal'},
        ];

		Isencao.findOne({ '_id': req.params.id }).populate(populateFields).exec(function (err, isencao) {
			if (!err && isencao) {
                isencao.descricao = isencao.descricao.replace('Isenção de mensalidade ','');
                req.options.result = isencao;
				res.render(self.route + '/printIsencaoMensalidade', req.options);
			}
		});

	};
};

module.exports = Controller;
