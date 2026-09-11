#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import requests
import json
import base64
import time
import uuid

# ==================== 配置区域 ====================
# 请在此填入您的通义万相 API Key
# 获取地址: https://bailian.console.aliyun.com/?apiKey=1#/api-key
API_KEY = 'sk-3fef30aeb6ad44579ba43340a906c429'

# 提示词 - 可根据需要修改
PROMPT = '保留原图中的人物特征、衣着、场景，将整体转换为可爱Q版卡通风格，大眼睛，圆润线条，明亮色彩，扁平化设计'

# ==================== 配置区域结束 ====================

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_POST(self):
        if self.path == '/cartoonize':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                
                if not API_KEY:
                    raise Exception('请在 server.py 中先配置通义万相 API Key')
                
                image_base64 = data.get('Image', '')
                prompt = data.get('Prompt', PROMPT)
                result = self.call_wanx_api(image_base64, prompt)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'ResultImage': result}).encode('utf-8'))
            except Exception as e:
                print(f'  [ERROR] {str(e)}')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
        else:
            super().do_POST()
    
    def call_wanx_api(self, image_base64, prompt):
        print('  [INFO] 开始调用通义万相 API (wan2.6-image)...')
        print(f'  [INFO] 使用提示词: {prompt[:80]}...')
        
        if len(API_KEY) < 10:
            raise Exception('API Key 似乎无效，请检查配置')
        
        # 构建完整的data URL
        image_data_url = f'data:image/jpeg;base64,{image_base64}'
        
        # 构建请求体
        request_payload = {
            'model': 'wan2.6-image',
            'input': {
                'messages': [
                    {
                        'role': 'user',
                        'content': [
                            {
                                'text': prompt
                            },
                            {
                                'image': image_data_url
                            }
                        ]
                    }
                ]
            },
            'parameters': {
                'prompt_extend': False,
                'watermark': False,
                'n': 1,
                'enable_interleave': False,
                'size': '1K'
            }
        }
        
        # 打印请求信息（不打印完整的base64图片）
        print('  [DEBUG] 请求信息:')
        print(f'  [DEBUG]   - URL: https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation')
        print(f'  [DEBUG]   - model: wan2.6-image')
        print(f'  [DEBUG]   - prompt: {prompt}')
        print(f'  [DEBUG]   - enable_interleave: False')
        print(f'  [DEBUG]   - size: 1K')
        print(f'  [DEBUG]   - 图片长度: {len(image_base64)} 字符')
        
        # 发送请求
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}'
        }
        
        try:
            print('  [INFO] 正在发送请求到通义万相...')
            response = requests.post(
                'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
                headers=headers,
                json=request_payload,
                timeout=120
            )
            
            print(f'  [INFO] 响应状态码: {response.status_code}')
            
            if response.status_code != 200:
                print(f'  [DEBUG] 响应内容: {response.text}')
                raise Exception(f'API返回HTTP {response.status_code}')
            
            result_data = response.json()
            print(f'  [DEBUG] 响应数据: {json.dumps(result_data, ensure_ascii=False)}')
            
            # 检查是否有错误
            if result_data.get('code'):
                raise Exception(f'{result_data.get("code")}: {result_data.get("message")}')
            
            # 提取生成的图片
            output = result_data.get('output', {})
            choices = output.get('choices', [])
            
            if not choices:
                raise Exception('API未返回图片结果')
            
            # 获取第一个choice
            choice = choices[0]
            message = choice.get('message', {})
            content = message.get('content', [])
            
            if not content:
                raise Exception('未找到图片内容')
            
            # 找到图片
            img_url = None
            for item in content:
                if item.get('type') == 'image':
                    img_url = item.get('image')
                    break
            
            if not img_url:
                raise Exception('未找到图片URL')
            
            print(f'  [INFO] 获取图片URL成功，正在下载...')
            
            # 下载图片
            img_response = requests.get(img_url, timeout=30)
            if img_response.status_code == 200:
                result_base64 = base64.b64encode(img_response.content).decode('utf-8')
                print(f'  [INFO] 成功处理完成！')
                return result_base64
            else:
                raise Exception(f'下载图片失败: HTTP {img_response.status_code}')
                
        except requests.exceptions.Timeout:
            raise Exception('请求超时，请稍后重试')
        except requests.exceptions.RequestException as e:
            raise Exception(f'网络请求失败: {str(e)}')
        except Exception as e:
            print(f'  [ERROR] {str(e)}')
            raise

def main():
    port = 8080
    httpd = HTTPServer(('', port), CORSRequestHandler)
    
    print('\n' + '='*60)
    print('拼豆图纸生成器 - 卡通化后端服务')
    print('='*60)
    
    if API_KEY:
        print(f'✓ API Key 已配置')
    else:
        print(f'⚠  警告: API Key 未配置')
        print(f'  请编辑 server.py 文件填入 API Key')
        print(f'  获取地址: https://bailian.console.aliyun.com/?apiKey=1#/api-key')
    
    print('')
    print(f'服务器已启动！')
    print(f'请在浏览器中打开: http://localhost:{port}/index.html')
    print(f'按 Ctrl+C 停止服务器')
    print('='*60 + '\n')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止')
        httpd.shutdown()

if __name__ == '__main__':
    main()
