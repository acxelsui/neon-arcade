using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

public static class NeonVideoEngine {
 public const string ArchiveURL="https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip";
 public const string ArchiveHash="60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba";
 public const string BinaryHash="3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec";
 public static readonly string DirectoryPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Neon Arcade","video-engine");
 public static string BinaryPath {get{return Path.Combine(DirectoryPath,"ffmpeg.exe");}}
 public static string Hash(Stream stream){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();}
 public static bool Available(){if(!File.Exists(BinaryPath))return false;try{using(var input=File.OpenRead(BinaryPath))return Hash(input)==BinaryHash;}catch{return false;}}
 public static async Task Install(Action<string> status){
  Directory.CreateDirectory(DirectoryPath);string archive=Path.Combine(DirectoryPath,"download.zip"),temporary=Path.Combine(DirectoryPath,"ffmpeg.pending");
  try{
   using(var http=new HttpClient()){http.Timeout=TimeSpan.FromMinutes(8);
    using(var reply=await http.GetAsync(ArchiveURL,HttpCompletionOption.ResponseHeadersRead)){
     reply.EnsureSuccessStatusCode();var destination=reply.RequestMessage.RequestUri;
     if(destination.Scheme!="https"||!(destination.Host=="www.gyan.dev"||destination.Host=="github.com"||destination.Host=="release-assets.githubusercontent.com"))throw new Exception("The video download address changed. Update Neon Launcher.");
     using(var input=await reply.Content.ReadAsStreamAsync())using(var output=File.Create(archive)){
      byte[] bytes=new byte[65536];long total=0;int count;
      while((count=await input.ReadAsync(bytes,0,bytes.Length))>0){total+=count;if(total>160000000)throw new Exception("The video download is too large.");await output.WriteAsync(bytes,0,count);status("Downloading video components: "+(total/1000000)+" MB. Sharing is off.");}
     }
    }
   }
   using(var input=File.OpenRead(archive))if(Hash(input)!=ArchiveHash)throw new Exception("Video download verification failed. Nothing was installed.");
   using(var zip=ZipFile.OpenRead(archive)){
    var entry=zip.GetEntry("ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe");if(entry==null||entry.Length>130000000)throw new Exception("Video components are missing.");
    // Extract one fixed filename, never archive paths or scripts.
    using(var input=entry.Open())using(var output=File.Create(temporary))await input.CopyToAsync(output);
   }
   using(var input=File.OpenRead(temporary))if(Hash(input)!=BinaryHash)throw new Exception("Video engine verification failed.");
   if(File.Exists(BinaryPath))File.Delete(BinaryPath);File.Move(temporary,BinaryPath);
  }finally{if(File.Exists(archive))File.Delete(archive);if(File.Exists(temporary))File.Delete(temporary);}
 }
}

// This parser also accepts generated test footage; it never reads a desktop.
public sealed class NeonMp4Reader {
 readonly Stream input;
 public NeonMp4Reader(Stream stream){input=stream;}
 static void ReadExactly(Stream input,byte[] bytes,int offset,int count){while(count>0){int read=input.Read(bytes,offset,count);if(read==0)throw new EndOfStreamException("Incomplete video fragment.");offset+=read;count-=read;}}
 public byte[] ReadBox(out string type){
  byte[] header=new byte[8];int first=input.ReadByte();if(first<0){type=null;return null;}header[0]=(byte)first;ReadExactly(input,header,1,7);
  long length=((long)header[0]<<24)|((long)header[1]<<16)|((long)header[2]<<8)|header[3];
  if(length<8||length>490000)throw new InvalidDataException("Video fragment is too large.");
  var box=new byte[(int)length];Buffer.BlockCopy(header,0,box,0,8);ReadExactly(input,box,8,box.Length-8);type=Encoding.ASCII.GetString(header,4,4);return box;
 }
 public void Read(Action<byte[]> initialize,Action<byte[]> segment){
  byte[] first=null,fragment=null;string type;byte[] box;
  while((box=ReadBox(out type))!=null){
   if(type=="ftyp"&&first==null)first=box;
   else if(type=="moov"&&first!=null){initialize(Join(first,box));first=null;}
   else if(type=="moof")fragment=box;
   else if(type=="mdat"&&fragment!=null){segment(Join(fragment,box));fragment=null;}
   else if(type!="mfra"&&type!="free")throw new InvalidDataException("Unexpected video fragment.");
  }
  if(first!=null||fragment!=null)throw new EndOfStreamException("Incomplete video stream.");
 }
 static byte[] Join(byte[] a,byte[] b){if(a.Length+b.Length>490000)throw new InvalidDataException("Video fragment is too large.");byte[] bytes=new byte[a.Length+b.Length];Buffer.BlockCopy(a,0,bytes,0,a.Length);Buffer.BlockCopy(b,0,bytes,a.Length,b.Length);return bytes;}
}

public sealed class NeonVideoCapture : IDisposable {
 readonly object gate=new object();readonly Queue<Dictionary<string,object>> pending=new Queue<Dictionary<string,object>>();
 readonly Process process;readonly int width,height;readonly string stream=Guid.NewGuid().ToString("N");
 string initialization=null,failure=null;long sequence=0;int queuedBytes=0;bool stopped=false;
 public static Size OutputSize(Size source){double scale=Math.Min(1.0,1280.0/Math.Max(source.Width,source.Height));return new Size(Math.Max(2,((int)(source.Width*scale)/2)*2),Math.Max(2,((int)(source.Height*scale)/2)*2));}
 public static string EncodingArguments(int width,int height){return " -an -vf scale="+width+":"+height+" -c:v libx264 -preset ultrafast -tune zerolatency -profile:v baseline -level:v 4.2 -pix_fmt yuv420p -b:v 2500k -maxrate 3500k -bufsize 700k -g 6 -keyint_min 6 -sc_threshold 0 -r 60 -movflags +empty_moov+default_base_moof+frag_keyframe -flush_packets 1 -f mp4 pipe:1";}
 public NeonVideoCapture(Rectangle screen){
  var size=OutputSize(screen.Size);width=size.Width;height=size.Height;
  string args="-hide_banner -loglevel error -nostdin -f gdigrab -framerate 60 -draw_mouse 1 -offset_x "+screen.Left+" -offset_y "+screen.Top+" -video_size "+screen.Width+"x"+screen.Height+" -i desktop"+EncodingArguments(width,height);
  process=new Process {StartInfo=new ProcessStartInfo {FileName=NeonVideoEngine.BinaryPath,Arguments=args,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true}};
  if(!process.Start())throw new Exception("The video engine could not start.");
  // Drain stderr so the encoder cannot block on a full diagnostic pipe.
  process.ErrorDataReceived+=(sender,eventArgs)=>{if(!String.IsNullOrWhiteSpace(eventArgs.Data))lock(gate)failure=eventArgs.Data.Substring(0,Math.Min(180,eventArgs.Data.Length));};process.BeginErrorReadLine();
  Task.Run(()=>{
   try{new NeonMp4Reader(process.StandardOutput.BaseStream).Read(bytes=>{lock(gate)initialization=Convert.ToBase64String(bytes);},bytes=>{
    string encoded=Convert.ToBase64String(bytes);lock(gate){if(stopped)return;pending.Enqueue(new Dictionary<string,object>{{"id",++sequence},{"data",encoded}});queuedBytes+=encoded.Length;while(pending.Count>6||queuedBytes>660000){var old=pending.Dequeue();queuedBytes-=((string)old["data"]).Length;}}
   });lock(gate)if(!stopped)failure=failure??"The video engine stopped. Reconnect to try again.";}
   catch(Exception error){lock(gate)if(!stopped)failure=error.Message;}
  });
 }
 public Dictionary<string,object> Take(){
  lock(gate){if(failure!=null)throw new Exception(failure);if(initialization==null)return null;
   var segments=pending.ToArray();pending.Clear();queuedBytes=0;
   return new Dictionary<string,object>{{"stream",stream},{"init",initialization},{"width",width},{"height",height},{"fps",60},{"segments",segments}};
  }
 }
 public void Dispose(){lock(gate){if(stopped)return;stopped=true;pending.Clear();initialization=null;}
  try{if(!process.HasExited)process.Kill();process.WaitForExit(1000);}catch{}process.Dispose();
 }
}
