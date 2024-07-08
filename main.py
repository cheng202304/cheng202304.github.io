import os
import cv2
import time
import numpy as np
from flask import Flask,request,render_template,jsonify
from werkzeug.utils import secure_filename

import base64
from io import BytesIO
from PIL import Image
from cameraDemo import Camera_reader
from faceRegnitionModel import  Model

app=Flask(__name__)
UPLOAD_PATH = os.path.join(os.path.dirname(__file__), 'static/images')

def read_name_list(path):
    "读取训练数据集"
    name_list=[]
    for child_dir in os.listdir(path):
        name_list.append(child_dir)
    return name_list

def detectOnePicture(path):
    "单图识别"
    model=Model()
    model.load()
    img=cv2.imread(path)
    img=cv2.resize(img,(128,128))
    img=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    picType,prob=model.predict(img)
    if picType !=-1:
        name_list=read_name_list('dataset/')
        print(name_list[picType],prob)
        res=u"识别为："+name_list[picType]+u"概率为： "+str(prob)
    else:
        res=u"抱歉，未识别该人，请尝试增加数据量来训练模型"
    return res

@app.route('/',methods=['POST','GET'])
def init():
    if request.method=='POST' and 'photo' in request.files:
        img_file=request.files.get('photo')
        file_name=img_file.filename
        #文件名安全转换
        filename=secure_filename(file_name)
        img_file.save(os.path.join(UPLOAD_PATH,filename))
        res= detectOnePicture(os.path.join(UPLOAD_PATH,filename))
        return render_template('show.html',res=res,filename=filename)
    return render_template('index.html',title='Home')
     
@app.route('/she/')
def she():
    camera=Camera_reader()
    camera.build_camera()
    return render_template('index.html',title='Home')

@app.route('/camera')
def camera():
    return render_template('camera.html')

@app.route('/upload_canvas',methods=['POST'])
def upload_canvas():
    data=request.json
    image_data=data['image']
    #去前缀'data:image/jpeg;base64;'
    image_data=image_data.split(",")[1]
    #解码base64数据
    image_data=base64.b64decode(image_data)
    #数据转换为图像
    image=Image.open(BytesIO(image_data))
    #保存图像
    image.save('static/images/uploaded_image.jpg')
    res= detectOnePicture(os.path.join(UPLOAD_PATH,'uploaded_image.jpg')) 
    return jsonify({'result': res})

if __name__ =='__main__':
    app.run(debug=True)




    







