const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const chalkFactory = require('chalk');
const winston = require('winston');
const archiver = require('archiver');

// 创建chalk实例
const chalk = chalkFactory.default ? chalkFactory.default : chalkFactory;

// 设置winston日志格式
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(info => `${info.timestamp} ${info.level} [Build] ${info.message}`)
            )
        }),
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            dirname: 'logs',
            format: winston.format.combine(
                winston.format.printf(info => `${info.timestamp} ${info.level} [Build] ${info.message}`)
            )
        }),
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            dirname: 'logs',
            level: 'error',
            format: winston.format.combine(
                winston.format.printf(info => `${info.timestamp} ${info.level} [Build] ${info.message}`)
            )
        })
    ],
});

// 读取构建配置
let buildConfig;
try {
    const configPath = path.join(process.cwd(), 'build.config.json');
    buildConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (error) {
    logger.error(chalk.red('无法读取build.config.json文件，请确保该文件存在且格式正确: ') + error.message);
    process.exit(1);
}

const { mod_name, ll_version } = buildConfig;

if (!mod_name || !ll_version || !Array.isArray(ll_version) || ll_version.length !== 3) {
    logger.error(chalk.red('build.config.json中的配置不正确，请确保包含mod_name和ll_version([major, minor, patch])字段'));
    process.exit(1);
}

// 检查命令行参数是否包含 'zip'
const isZipMode = process.argv[2] === 'zip';

// 针对web项目的修改：定义输出目录和相关路径
const distDir = path.resolve(`./output/${mod_name}`);
const bundlePath = path.resolve(`./output/${mod_name}/main.js`);

function executeCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { ...options, ...(options.stdio !== 'inherit' ? {} : { shell: true }) });

        // 只有在stdio不是inherit时才添加数据监听器
        if (options && options.stdio !== 'inherit') {
            child.stdout.on('data', (data) => {
                logger.info(chalk.gray(data.toString()));
            });

            child.stderr.on('data', (data) => {
                // 将stderr也视为info级别的日志，因为对于某些命令这是正常输出
                logger.info(chalk.gray(data.toString()));
            });
        }

        child.on('close', (code) => {
            if (code === 0) {
                resolve(code);
            } else {
                reject(new Error(`命令 "${command} ${args.join(' ')}" 执行失败，退出码: ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

// 创建ZIP文件的函数
async function createZip() {
    logger.info(chalk.blue('开始创建ZIP文件...'));
    
    // 确保output目录存在
    if (!fs.existsSync('./output')) {
        fs.mkdirSync('./output', { recursive: true });
    }
    
    // 定义ZIP文件路径
    const zipPath = path.join('./output', `${mod_name}.zip`);
    
    // 创建输出流
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
        zlib: { level: 9 } // 设置压缩级别为最高
    });
    
    // 监听完成事件
    output.on('close', () => {
        logger.info(chalk.green(`ZIP文件创建成功: ${zipPath}, 大小: ${archive.pointer()} 字节`));
        logger.info(chalk.green('ZIP构建任务已完成！'));
    });
    
    // 监听错误事件
    archive.on('error', (err) => {
        logger.error(chalk.red('创建ZIP文件时发生错误:'), err.message);
        process.exit(1);
    });
    // 将输出流与归档关联
    archive.pipe(output);
    
    // 添加整个mod目录到ZIP
    archive.directory(distDir, false);
    
    // 完成归档
    await archive.finalize();
}

async function build() {
    logger.info(chalk.blue('开始构建项目...'));

    try {
        await executeCommand('npx', ['rollup', '-c'], { stdio: 'inherit', shell: true });
        logger.info(chalk.green('Rollup打包成功'));

        // 复制前端文件到输出目录
        logger.info(chalk.blue('正在复制前端文件到输出目录...'));
        copyDirectory('./src/frontend', `./output/${mod_name}/frontend`);

        // 复制后端代码到输出目录
        logger.info(chalk.green('正在复制后端代码到输出目录...'));
        copyDirectory('./dist/', `./output/${mod_name}/`);

        logger.info(chalk.green(`构建完成，已生成到 output/${mod_name} 目录`));

        // 生成manifest.json文件
        const manifest = {
            "entry": "main.js",
            "name": mod_name,
            "type": "lse-nodejs",
            "dependencies": [
                {
                    "name": "legacy-script-engine-nodejs"
                }
            ]
        }

        const manifestPath = path.join(distDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        logger.info(chalk.green(`已生成manifest.json文件: ${manifestPath}`));

        // 如果是zip模式，则创建ZIP文件
        if (!isZipMode) {
            logger.info(chalk.green('构建任务已完成！'));
        } else {
            await createZip();
        }
    } catch (error) {
        logger.error(chalk.red('构建失败:'), error.message);
        process.exit(1);
    }
}

// 复制目录函数
function copyDirectory(src, dest) {
    if (!fs.existsSync(src)) {
        logger.info(chalk.yellow(`源目录不存在: ${src}`));
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const items = fs.readdirSync(src);

    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);

        if (fs.lstatSync(srcPath).isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            logger.info(chalk.gray(`已复制文件: ${srcPath} -> ${destPath}`));
        }
    }
}

// 执行一次性构建
build().catch(err => {
    logger.error(chalk.red('构建过程中出现错误:'), err.message);
    process.exit(1);
});