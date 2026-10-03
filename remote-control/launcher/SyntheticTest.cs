using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Web.Script.Serialization;
// Run explicitly with generated MP4 footage. No Form, desktop capture, input,
// saved device credentials, or network connection is created by this test.
class SyntheticTest {
 static void Require(bool value,string message){if(!value)throw new Exception(message);}
 static void Main(string[] args){
  using(var encoder=new NeonFrameEncoder())using(var bitmap=new Bitmap(1920,1080))using(var drawing=Graphics.FromImage(bitmap)){
   int width,height;drawing.Clear(Color.Red);var first=Convert.FromBase64String(encoder.Encode(bitmap,out width,out height));Require(width==1280&&height==720,"Incorrect landscape size");
   drawing.Clear(Color.Blue);var second=Convert.FromBase64String(encoder.Encode(bitmap,out width,out height));
   using(var input=new MemoryStream(first))using(var image=new Bitmap(input))Require(image.GetPixel(500,300).R>200,"First frame corrupt");
   using(var input=new MemoryStream(second))using(var image=new Bitmap(input))Require(image.GetPixel(500,300).B>200,"Reused bitmap retained stale pixels");
   using(var portrait=new Bitmap(1080,1920)){encoder.Encode(portrait,out width,out height);Require(width==720&&height==1280,"Incorrect portrait size");}
  }
  Require(NeonVideoCapture.OutputSize(new Size(1920,1080))==new Size(1280,720),"Invalid video dimensions");
  Require(NeonVideoCapture.OutputSize(new Size(101,77))==new Size(100,76),"Video dimensions must be even");
  string init=null;var segments=new List<Dictionary<string,object>>();long id=0;
  using(var input=File.OpenRead(args[0]))new NeonMp4Reader(input).Read(bytes=>init=Convert.ToBase64String(bytes),bytes=>segments.Add(new Dictionary<string,object>{{"id",++id},{"data",Convert.ToBase64String(bytes)}}));
  Require(init!=null&&segments.Count==30,"Generated video did not split into 30 fragments");
  using(var input=new MemoryStream(new byte[]{0,0,0,8,109,111,111,102})){
   bool rejected=false;try{new NeonMp4Reader(input).Read(bytes=>{},bytes=>{});}catch(EndOfStreamException){rejected=true;}Require(rejected,"Truncated fragment was accepted");
  }
  using(var input=new MemoryStream(new byte[]{0,16,0,0,109,100,97,116})){
   bool rejected=false;try{string type;new NeonMp4Reader(input).ReadBox(out type);}catch(InvalidDataException){rejected=true;}Require(rejected,"Unbounded fragment allocation was accepted");
  }
  var json=new JavaScriptSerializer {MaxJsonLength=8000000};File.WriteAllText(args[1],json.Serialize(new Dictionary<string,object>{{"stream",new string('a',32)},{"init",init},{"segments",segments},{"width",1280},{"height",720},{"fps",60}}));
  Console.WriteLine("Synthetic launcher encoding, buffer reuse, MP4 parsing and bounds passed. No desktop was captured or controlled.");
 }
}
