'use strict';

// require default controller
var controller = require('../controllers/controller'),
    mongoose = require('mongoose'),
    config = require('../config'),
    moment = require('moment'),
    mongodbBackup = require('mongodb-backup'),
    mongodbRestore = require('mongodb-restore'),
    helper    = require('../config/helper'),
    chalk = require('chalk'),
    fs      = require('fs'),
    multer = require('multer'),
    // schedule = require('node-schedule'),
    chalk = require('chalk'),
    Configuracao = require('../models/configuracao'),
    Client = require('ftp');

var Controller = new controller({
  route           : 'database',
  menu            : 'Configuração',
  pageName        : 'Banco de dados',
  pageNamePlural  : 'Banco de dados',
  model           : 'cartao'
});

var jobBackup;

var BACKUP_ROOT = '../backups/database/',
    BACKUP_PARSER = 'bson';

Controller.customRoutes = function(app) {
  var upload = multer({ dest: 'uploads/' });
  app.get('/'+this.route+'/restore/:file', /*this.autentication(), this.permission('restore'),*/ this.default(), this.restore())
     .get('/'+this.route+'/download/:file', this.autentication(), this.permission('download'), this.default(), this.download())
     .post('/'+this.route+'/import/', this.autentication(), this.permission('import'), this.default(), upload.single('file'), this.import());
};

Controller.import = function() {
  var self  = this;

  return function(req, res, next) {
    // console.log('Enviando backup '+req.file.originalname);
    if(req.session.configuracao && req.session.configuracao.app.backup.root) {
        if(req.file.size === 0) {
          req.flash('error','Selecione o arquivo de backup.');
          res.redirect('/'+self.route);
        } else {
          fs.readFile(req.file.path, function (err, data) {
            if(fs.existsSync(req.session.configuracao.app.backup.root)) {
                fs.writeFile(req.session.configuracao.app.backup.root + req.file.originalname, data, function (err) {
                  if(err)
                    req.flash('error','Ocorreu um erro ao enviar o backup.<br />'+err);
                  res.redirect('/'+self.route);
                });
            } else {
              req.flash('error','Diretório de backups não encontrado.');
              res.redirect('/'+self.route);
            }
          });
        }
    } else {
        req.flash('error','Diretório de backups não configurado.');
        res.redirect('/'+self.route);    
    }

  };
};

Controller.restore = function(io) {
   var self  = this;

  return function(req, res, next) {
    var stream = fs.createReadStream(req.session.configuracao.app.backup.root + req.params.file);

    console.log('iniciando restore');

    mongodbRestore({
      uri: config.db.uri,
      stream: stream,
      drop: req.query.drop ? true : false,
      parser: BACKUP_PARSER, // json
      options: config.db.options,
      callback: function(err) {
        if(err) {
          console.log(err);
          req.flash('error','Ocorreu um erro ao restaurar o backup.<br />'+err);
        } else {
          req.flash('success','Backup restaurado com sucesso.');
          // req.io.emit('showNotification', {err: 0, message: 'Um backup do banco de dados foi restaurado.'});
        }
          
        res.redirect('/'+self.route);

      }
    });

  };
};

Controller.download = function() {
  return function(req, res, next) {
    if(req.session.configuracao && req.session.configuracao.app.backup.root) {
        if(fs.existsSync(req.session.configuracao.app.backup.root + req.params.file)) {
            res.download(req.session.configuracao.app.backup.root + req.params.file);
        } else {
            throw new Error('O backup não foi encontrado');
        }
    } else
      throw new Error('Diretório de backups não encontrado.');
  };
};

Controller.delete = function() {
  var self = this;
  return function(req, res, next) {
      self.deleteBackup(req.params.id, function(err) {
        if(err)
          res.json({err: 1, message: 'Não foi possível realizar a operação.'});
        else {
          if(req.body.redirect && req.body.redirect === 'true')
            res.json({err: 0, redirect: '/'+self.route});
          else {
            // to dando redirect pra atualizar o numero de backups na aba
            res.json({err: 0, redirect: '/'+self.route});
            // res.json({err: 0, message: ''});
          }
        }
      });
  };
};

Controller.create = function() {
  var self  = this;

  return function(req, res, next) {
    console.log('Iniciando rota create');
  
    self.createBackup(req.session.configuracao, function(err, message) {
      console.log('callback recebido do createBackup na rota create / msg do callback: '+message);
      req.io.emit('showNotification', {err: err ? 1 : 0, message: message});
      req.flash(err ? 'error' : 'success', message);
      res.redirect('/'+self.route);
    });

    
  };

};

Controller.update = function() {
  return function(req, res, next) {
    Configuracao.update({}, {$set: { 'app.backup': req.body }}, {multi: false, upsert: false}, function(err) {
      if(err)
        res.json({err: 1, message: 'Não foi possível salvar a configuração.'});
      else
        res.json({err: 0, message: 'Configuração salva com sucesso.'});
      });
  };
};

Controller.read = function() {
  var self = this;

  return function(req, res, next) {
    var mongoAdmin = new mongoose.mongo.Admin(mongoose.connection.db);

    mongoAdmin.serverStatus(function(err, info) {
       req.options.database = info;
       mongoose.connection.db.stats(function(err, stats) {
          req.options.database.stats = stats;

          self.readBackup(function(err, files) {
            if(!err) {
              req.options.result = files;
              res.render(self.route, req.options);
            } else {
              var message = files;
              req.options.flash.error = message;
              res.render(self.route, req.options);
            }
          });

       });
    });
  };
};

Controller.readBackup = function(callback) {
  var files = [];

  Configuracao.findOne({}, function(err, configuracao) {
      if(!err && configuracao && configuracao.app.backup.root) {     
        if(fs.existsSync(configuracao.app.backup.root)) {
            helper.getGlobbedFiles(configuracao.app.backup.root + '*.tar', configuracao.app.backup.root).forEach(function(file) {
              var stats = fs.statSync(configuracao.app.backup.root + file);

              file = {
                arquivo: file,
                data: helper.formataData(stats.birthtime),
                data_criacao: stats.birthtime,
                tamanho: stats.size,
              };

              files.push(file);
            });

            callback(null, files);
        } else 
          callback(true, 'Diretório de backups não encontrado.');
      } else 
        callback(true, 'Diretório de backups não configurado.');
  });

};

Controller.deleteBackup = function(file, callback) {
  Configuracao.findOne({}, function(err, configuracao) {
    if(!err && configuracao && configuracao.app.backup.root) {
      if(fs.existsSync(configuracao.app.backup.root + file)) {
        fs.unlink(configuracao.app.backup.root + file, function(err) {
            // console.log(err);
            callback(err);
        });
      } else {
        callback(true);
      }
    }
  });
};

Controller.createBackup = function(configuracao, callback) {
  console.log('Iniciando createBackup');

  var timestamp = Date.now();

  var filename = moment().format('DD-MM-YYYY-HH-mm-');
  filename += helper.removeAcento( configuracao.empresa.razao_social.replace(/[^\w\s]/gi, '') );
  filename += '.tar';
  filename = filename.replace(/ /g, '-');

  if(fs.existsSync(configuracao.app.backup.root)) {

    var stream = fs.createWriteStream(configuracao.app.backup.root + filename);

    mongodbBackup({
      uri: config.db.uri,
      stream: stream,
      parser: BACKUP_PARSER, // json
      options: config.db.options,
      callback: function(err) {
        if(!err) {
            if(configuracao.app.backup.ftp.ativo) { 
              if(configuracao.app.backup.ftp.endereco && configuracao.app.backup.ftp.porta && configuracao.app.backup.ftp.usuario && configuracao.app.backup.ftp.senha) {
                console.log('Iniciando o upload.');

                  var c = new Client();
                  c.on('ready', function() {
                    console.log('FTP conectado com sucesso.');
                    c.put(configuracao.app.backup.root+filename, filename, function(err) {
                      console.log('Fim do upload.');
                      c.end();
                      if(callback) {
                        if(err)
                          callback(true, 'Falha ao criar backup online.<br />'+err);
                        else
                          callback(false, 'Backup criado e enviado para o endereço FTP.');
                      }
                    });
                  });

                  c.on('error', function(err) {
                    if(err && err !== 'Error: Logout.') {
                      callback(true, 'Falha ao criar backup online.<br />'+err);
                      c.end();
                    }
                  });

                  c.connect({
                    port: configuracao.app.backup.ftp.porta,
                    host: configuracao.app.backup.ftp.endereco,
                    user: configuracao.app.backup.ftp.usuario,
                    password: configuracao.app.backup.ftp.senha
                  });

              } else {
                callback(true, 'Backup criado porem houve um erro ao enviar para o endereço FTP. Verifique os campos Endereço FTP, Porta, Usuário e Senha.');
              }

            } else {
              console.log('Upload não configurado.');
              if(callback) callback(false, 'Backup criado com sucesso.<br />Backup Online está desativado.');
            }

        } else {
          console.log('deu ruim no backup');
          console.log(err);
          if(callback) callback(false, 'Ocorreu um erro ao criar o backup.<Br />'+err);
        }
      }
    });
  } else 
    callback(true, 'Diretório de backups não encontrado.');
};

Controller.cleanOldBackup = function(configuracao) {
  var self = this;
  
  var limiteArmazenamento = 7;
  if(configuracao.app.backup.tempo_limite_armazenamento)
    limiteArmazenamento = configuracao.app.backup.tempo_limite_armazenamento;

  self.readBackup(function(err, files) {
    if(files && files.length) {
      var nenhumExcluido = true;

      for (var i = files.length - 1; i >= 0; i--) {
        var dateDiferencaEmDias = helper.dateDiferencaEmDias(new Date(files[i].data_criacao), new Date());
        var arquivo = files[i].arquivo;

        if(dateDiferencaEmDias > limiteArmazenamento && String(arquivo) !== 'default-database.tar') {
          self.deleteBackup(arquivo, function(err) {
            if(err)
              console.error(chalk.red(helper.formataData(new Date()) +' - Error on deleting backup "'+arquivo+'".'));
            else {
              nenhumExcluido = false;
              console.log(helper.formataData(new Date()) +' - Backup file "'+arquivo+'" deleted.');               
            }
          });
        }
      
      }

      // if(nenhumExcluido) 
        // console.log(helper.formataData(new Date()) +' - Não foi encontrado nenhum backup antigo.');

    } else 
      console.log(chalk.red(helper.formataData(new Date()) +' - No backup found.'));
  });
};

Controller.scheduleJobBackup = function() {
  console.log('Iniciando scheduleJobBackup');
  var self = this;

  Configuracao.findOne({}, function(err, configuracao) {

    if(configuracao && !err) {
        if(configuracao.app && configuracao.app.backup && configuracao.app.backup.frequencia && configuracao.app.backup.frequencia >= 1 && configuracao.app.backup.frequencia <= 100) {
          console.log('configuracao.app.backup.frequencia :'+configuracao.app.backup.frequencia);
          
          jobBackup = setInterval(function() {  
            console.log('Iniciando createBackup');

            self.createBackup(configuracao, function(err, message) {
              if(err)
                console.error(chalk.red(helper.formataData(new Date()) + message));
              else 
                console.log(helper.formataData(new Date()) +' - Scheduled database backup created.');
            });

            self.cleanOldBackup(configuracao);

          }, 60 * 1000 * (60 * configuracao.app.backup.frequencia));

        } else {
          console.error(chalk.red(helper.formataData(new Date()) + ' - Backup not configured yet.'));
        }
    }

  });
};

Controller.initialScheduling = function() {
  this.scheduleJobBackup();
}

Controller.checkDatabase = function(db) {
  db.connection.db.stats(function(err, stats) {
    if(!stats || !stats.collections || stats.collections <= 5) {
      console.log(chalk.red('Banco de Dados ainda não configurado!'));

      if(fs.existsSync(BACKUP_ROOT+'default-database.tar')) {
        helper.ask('Deseja importar a banco de dados inicial? [sim/não]', function(err, answer) {
          answer = answer.toLowerCase();
          if(answer === 'sim' || answer === 's') {
            console.log('Aguarde...');
            mongodbRestore({
                uri: config.db.uri,
                root: BACKUP_ROOT, 
                tar: 'default-database.tar',
                drop: true,
                parser: 'bson', // json
                options: config.db.options,
                callback: function(err) {
                  if(err)
                    console.log(chalk.red('Ocorreu um erro ao importar a configuração inicial.'));
                  else {
                // mongoose.connection.db.command({"convertToCapped": 'movimentopatios', size: 8192}, function(err, result) {
                //  if(err)
                //    console.log(chalk.red('Falha ao converter para Capped'));
                // }); 

                      console.log(chalk.green('Banco de Dados configurado com sucesso.'));
                    this.initialScheduling();
                  }
                }
              });
          } else
            process.exit();
        });
      } else {
        console.log(chalk.red('O arquivo com o banco de dados default ("'+BACKUP_ROOT+'default-database.tar") não foi encontrado.'));
        process.exit();
      }
    } else {
      Controller.initialScheduling();
    }
  });
}

/*
ftp.brasolucoes.com
hangar@brasolucoes.com
nwTE=7=e;.T~
*/

module.exports = Controller;