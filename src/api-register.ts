import { Request, Response, Router } from 'express';

// 定义API处理器的类型
type ApiHandler = (req: Request, res: Response) => void | Promise<void>;

interface ApiRoute {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  handler: ApiHandler;
}

class ApiRegister {
  private routes: ApiRoute[] = [];

  // 注册GET请求
  get(path: string, handler: ApiHandler): void {
    this.routes.push({ method: 'get', path, handler });
  }

  // 注册POST请求
  post(path: string, handler: ApiHandler): void {
    this.routes.push({ method: 'post', path, handler });
  }

  // 注册PUT请求
  put(path: string, handler: ApiHandler): void {
    this.routes.push({ method: 'put', path, handler });
  }

  // 注册DELETE请求
  delete(path: string, handler: ApiHandler): void {
    this.routes.push({ method: 'delete', path, handler });
  }

  // 应用所有路由到Express应用
  applyRoutes(router: Router): void {
    this.routes.forEach(route => {
      switch (route.method) {
        case 'get':
          router.get(route.path, route.handler);
          break;
        case 'post':
          router.post(route.path, route.handler);
          break;
        case 'put':
          router.put(route.path, route.handler);
          break;
        case 'delete':
          router.delete(route.path, route.handler);
          break;
      }
    });
  }
}

export { ApiRegister, ApiHandler };