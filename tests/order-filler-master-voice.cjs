require('./order-filler-master-runner.cjs')('voice').catch(error=>{console.error(error);process.exitCode=1;});
