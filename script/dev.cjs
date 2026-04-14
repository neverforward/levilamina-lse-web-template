const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const chalkFactory = require('chalk');
const winston = require('winston');
const kill = require('tree-kill');

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
                winston.format.printf(info => `${info.timestamp} ${info.level} [Dev] ${info.message}`)
            )
        }),
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            dirname: 'logs',
            format: winston.format.combine(
                winston.format.printf(info => `${info.timestamp} ${info.level} [Dev] ${info.message}`)
            )
        }),
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            dirname: 'logs',
            level: 'error',
            format: winston.format.combine(
                winston.format.printf(info => `${info.timestamp} ${info.level} [Dev] ${info.message}`)
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

const mcServerPath = path.resolve('./mcserver');
const srcDir = path.resolve('./src');
const distDir = path.resolve('./mcserver/plugins', mod_name);

let mcServerProcess = null;

// 运行命令
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

// 下载MC服务器
async function InstallMCServer() {
    logger.info(chalk.green('检查LeviLamina是否已安装...'));

    // 检查是否有bedrock_server_mod.exe
    const bedrockExe = path.join(mcServerPath, 'bedrock_server_mod.exe');
    if (!fs.existsSync(bedrockExe)) {
        logger.info(chalk.yellow(`未找到bedrock_server_mod.exe，将安装LeviLamina...`));

        // 确保目录存在
        if (!fs.existsSync(mcServerPath)) {
            fs.mkdirSync(mcServerPath, { recursive: true });
        }

        // 根据ll_version确定安装命令
        let installCmd, installArgs;
        if (ll_version[0] === 0 && ll_version[1] === 0 && ll_version[2] === 0) {
            installCmd = 'lip';
            installArgs = ['install', 'github.com/LiteLDev/LeviLamina'];
            logger.info(chalk.cyan('ll_version为0.0.0，将安装最新版本的LeviLamina'));
        } else {
            const llVersionStr = `${ll_version[0]}.${ll_version[1]}.${ll_version[2]}`;
            installCmd = 'lip';
            installArgs = ['install', `github.com/LiteLDev/LeviLamina@${llVersionStr}`];
        }

        logger.info(chalk.cyan(`执行命令: ${installCmd} ${installArgs.join(' ')}`));

        try {
            await executeCommand(installCmd, installArgs, { cwd: mcServerPath });
            logger.info(chalk.green('LeviLamina安装成功'));
        } catch (error) {
            logger.error(chalk.red('LeviLamina安装失败:'), error.message);
            logger.info(chalk.yellow('请确认lip工具已正确安装并可执行'));
            process.exit(1);
        }
    } else {
        logger.info(chalk.green('已安装LeviLamina，跳过'));
    }

    // 下载lse

    const LSEFloder = path.join(mcServerPath, 'plugins/legacy-script-engine-nodejs');
    if (!fs.existsSync(LSEFloder)) {
        logger.info(chalk.yellow(`未找到legacy-script-engine-nodejs，将安装LSE...`));

        // 运行lip安装lse
        logger.info(chalk.cyan(`执行命令: lip install github.com/LiteLDev/LegacyScriptEngine#nodejs`));
        try {
            await executeCommand('lip', ['install', 'github.com/LiteLDev/LegacyScriptEngine#nodejs'], { cwd: mcServerPath });
            logger.info(chalk.green('LSE安装成功'));
        } catch (error) {
            logger.error(chalk.red('LSE安装失败:'), error.message);
            logger.info(chalk.yellow('请确认lip工具已正确安装并可执行'));
            process.exit(1);
        }
    } else {
        logger.info(chalk.green('LSE已存在，无需安装'));
    }
}

// 复制文件夹函数
async function copyDirectory(src, dest) {
    if (!fs.existsSync(src)) {
        logger.error(chalk.red(`源目录不存在: ${src}`));
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 构建部署
async function buildAndDeploy() {
    logger.info(chalk.blue('开始构建项目...'));

    try {
        // 执行Rollup构建
        logger.info(chalk.blue('执行Rollup构建...'));
        await executeCommand('npx', ['rollup', '-c'], { stdio: 'inherit', shell: true });
        logger.info(chalk.green('✓ Rollup构建完成'));

        const modPath = path.join(distDir, 'mod.json');

        // 确保dist目录存在
        if (!fs.existsSync('./dist')) {
            fs.mkdirSync('./dist', { recursive: true });
        }

        // 检查是否存在frontend目录，如果有则复制内容
        const frontendSrc = './src/frontend';
        const frontendDist = './dist/frontend';
        if (fs.existsSync(frontendSrc)) {
            logger.info(chalk.blue(`正在复制前端资源文件 ...`));

            if (!fs.existsSync(frontendDist)) {
                fs.mkdirSync(frontendDist, { recursive: true });
            }

            const frontendFiles = fs.readdirSync(frontendSrc);
            for (const file of frontendFiles) {
                const srcPath = path.join(frontendSrc, file);
                const destPath = path.join(frontendDist, file);

                if (fs.statSync(srcPath).isFile()) {
                    fs.copyFileSync(srcPath, destPath);
                    logger.info(chalk.green(`✓ 复制前端文件: ${file}`));
                }
            }
        }

        // 生成manifest.json
        logger.info(chalk.blue(`正在生成manifest.json ...`));
        const manifest = {
            "entry": "main.js",
            "name": mod_name,
            "type": "lse-nodejs",
            "dependencies": [
                {
                    "name": "legacy-script-engine-nodejs"
                }
            ]
        };

        const manifestPath = './dist/manifest.json';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        logger.info(chalk.green(`✓ manifest.json 已生成`));

        // 复制文件
        logger.info(chalk.blue(`正在复制文件 ...`));
        await copyDirectory('./dist', distDir);
        logger.info(chalk.green('✓ 文件复制完成'));

        logger.info(chalk.green('项目构建完成！'));

        if (mcServerProcess) stopServer();
        startMinecraftServer();

        logger.info(chalk.green(`构建完成，已部署到服务器，正在重启服务器`));
    } catch (error) {
        logger.error(chalk.red('构建失败:'), error.message);
    }
}

// 停止服务器
function stopServer() {
    if (mcServerProcess) {
        logger.info(chalk.green('正在停止Minecraft服务器...'));
        kill(mcServerProcess.pid, 'SIGTERM', (err) => {
            if (err) {
                logger.error(chalk.red('停止服务器时出错:'), err.message);
            } else {
                logger.info(chalk.green('服务器已停止'));
            }
        });
    }
}

// 启动服务器
function startMinecraftServer() {
    const bedrockExe = path.join(mcServerPath, 'bedrock_server_mod.exe');

    if (!fs.existsSync(bedrockExe)) {
        logger.error(chalk.red('bedrock_server_mod.exe 不存在，无法启动服务器'));
        return;
    }

    logger.info(chalk.green('正在启动Minecraft服务器...'));
    mcServerProcess = spawn(bedrockExe, { cwd: mcServerPath, stdio: 'inherit', shell: true });

    mcServerProcess.on('error', (err) => {
        logger.error(chalk.red('启动Minecraft服务器时发生错误:'), err.message);
        mcServerProcess = null;
    });

    // 服务器应该保持运行，我们只在发生错误时才重置mcServerProcess
    logger.info(chalk.green('Minecraft服务器已启动并正在运行...'));
}

async function setupWatcher() {
    // 先检查并安装LeviLamina
    await InstallMCServer();

    // 初次构建
    await buildAndDeploy();

    // 用于跟踪上次构建时间，防止重复触发
    let lastBuildTime = 0;

    // 监听src目录变化
    logger.info(chalk.blue(`正在监听${srcDir}目录下的文件变化...`));

    fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
        if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
            const now = Date.now();

            // 防止重复快速触发，至少间隔1秒
            if (now - lastBuildTime < 1000) {
                return;
            }

            lastBuildTime = now;

            logger.info(chalk.magenta(`${eventType}事件触发: ${filename}`));
            logger.info(chalk.yellow('检测到文件变更，重新构建...'));
            buildAndDeploy();
        }
    });
}

// 启动监控
setupWatcher().catch(err => {
    logger.error(chalk.red('启动过程中出现错误:'), err.message);
    process.exit(1);
});