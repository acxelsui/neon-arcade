using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

public class NeonLauncher : Form {
 const string AccountSite="https://neon-arcade-improvedv3.vercel.app";
 readonly HttpClient http=new HttpClient();
 readonly JavaScriptSerializer json=new JavaScriptSerializer {MaxJsonLength=1000000};
 readonly Label status=new Label(),pairCode=new Label(),account=new Label();
 readonly Button pair=new Button(),sharing=new Button(),website=new Button();
 readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer();
 readonly HashSet<int> heldKeys=new HashSet<int>(),heldButtons=new HashSet<int>();
 readonly string saved=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Neon Arcade","launcher.dat");
 string credential=null,code=null;bool paired=false,enabled=false,active=false,busy=false,closing=false;long ack=0;
 [DllImport("user32.dll")]static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")]static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll",SetLastError=true)]static extern uint SendInput(uint count,INPUT[] input,int size);
 [StructLayout(LayoutKind.Sequential)]struct INPUT{public uint type;public InputUnion value;}
 [StructLayout(LayoutKind.Explicit)]struct InputUnion{[FieldOffset(0)]public MOUSEINPUT mouse;[FieldOffset(0)]public KEYBDINPUT key;}
 [StructLayout(LayoutKind.Sequential)]struct MOUSEINPUT{public int dx,dy;public uint mouseData,dwFlags,time;public IntPtr extra;}
 [StructLayout(LayoutKind.Sequential)]struct KEYBDINPUT{public ushort vk,scan;public uint flags,time;public IntPtr extra;}

 public NeonLauncher(){
  Text="Neon Launcher · Remote access";Size=new Size(560,435);MinimumSize=Size;MaximumSize=Size;StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(12,24,40);ForeColor=Color.FromArgb(230,243,255);Font=new Font("Segoe UI",10);FormBorderStyle=FormBorderStyle.FixedSingle;MaximizeBox=false;
  var title=new Label {Text="NEON LAUNCHER",Font=new Font("Segoe UI",19,FontStyle.Bold),Location=new Point(26,25),Size=new Size(470,42)};
  var note=new Label {Text="Pair this PC with your Neon owner account. You control when sharing is enabled. Closing this window stops sharing.",Location=new Point(28,80),Size=new Size(465,58)};
  account.Location=new Point(28,142);account.Size=new Size(470,25);account.Text="Not paired with a Neon account";
  pairCode.Location=new Point(28,178);pairCode.Size=new Size(470,35);pairCode.Font=new Font("Consolas",16,FontStyle.Bold);pairCode.Text="Pair this PC to get a code";
  SetButton(pair,"Pair this PC",28,235,145);SetButton(website,"Open Neon",188,235,145);SetButton(sharing,"Start sharing",348,235,155);sharing.Enabled=false;
  status.Location=new Point(28,297);status.Size=new Size(475,65);status.Text="Sharing is off. No screen is being captured.";
  Controls.AddRange(new Control[]{title,note,account,pairCode,pair,website,sharing,status});
  http.Timeout=TimeSpan.FromSeconds(12);ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
  pair.Click+=async(s,e)=>await Enroll();website.Click+=(s,e)=>System.Diagnostics.Process.Start(AccountSite+"/?remote=1");
  sharing.Click+=async(s,e)=>{enabled=!enabled;active=false;ReleaseAll();sharing.Text=enabled?"Stop sharing":"Start sharing";status.Text=enabled?"Sharing enabled. Waiting for your Neon owner account to connect.":"Sharing is off. No screen is being captured.";await Poll();};
  FormClosing+=(s,e)=>{closing=true;enabled=false;ReleaseAll();timer.Stop();http.Dispose();};
  timer.Interval=5000;timer.Tick+=async(s,e)=>{if(!busy)await Poll();};
  Load+=(s,e)=>{Restore();timer.Start();};
 }
 void SetButton(Button b,string text,int x,int y,int width){b.Text=text;b.Location=new Point(x,y);b.Size=new Size(width,40);b.FlatStyle=FlatStyle.Flat;b.FlatAppearance.BorderColor=Color.FromArgb(65,114,154);b.BackColor=Color.FromArgb(23,54,85);b.ForeColor=ForeColor;}
 async Task<Dictionary<string,object>> Request(string action,Dictionary<string,object> body=null,bool authenticate=true){
  body=body??new Dictionary<string,object>();body["action"]=action;
  using(var request=new HttpRequestMessage(HttpMethod.Post,AccountSite+"/api/remote-agent")){
   request.Content=new StringContent(json.Serialize(body),Encoding.UTF8,"application/json");if(authenticate&&credential!=null)request.Headers.TryAddWithoutValidation("Authorization","Device "+credential);
   using(var response=await http.SendAsync(request)){
    string text=await response.Content.ReadAsStringAsync();var value=json.DeserializeObject(text) as Dictionary<string,object>;
    if(value==null)throw new Exception("The Neon website did not answer. Try again.");
    if(!response.IsSuccessStatusCode)throw new Exception(value.ContainsKey("error")?Convert.ToString(value["error"]):"Connection failed.");return value;
   }
  }
 }
 async Task Enroll(){
  if(busy)return;busy=true;pair.Enabled=false;enabled=false;active=false;sharing.Enabled=false;sharing.Text="Start sharing";ReleaseAll();
  try{
   var result=await Request("enroll",new Dictionary<string,object>{{"name",Environment.MachineName}},false);
   credential=Convert.ToString(result["credential"]);code=Convert.ToString(result["code"]);paired=false;ack=0;
   pairCode.Text=code.Substring(0,4)+"-"+code.Substring(4,4)+"-"+code.Substring(8,4)+"-"+code.Substring(12,4);account.Text="Sign into your Neon owner account";
   status.Text="On Neon Arcade, open Remote access and enter this code. The code expires in five minutes. Sharing stays off until you start it.";
  }catch(Exception error){status.Text=error.Message;}finally{busy=false;pair.Enabled=true;}
 }
 async Task Poll(){
  if(busy||closing||credential==null)return;busy=true;
  try{
   if(!paired){
    var claimed=await Request("claim");if(Convert.ToBoolean(claimed["paired"])){
     paired=true;string name=Convert.ToString(claimed["ownerName"]);account.Text="Linked to Neon owner: "+name;pairCode.Text="PC paired · sharing is off";sharing.Enabled=true;status.Text="Click Start sharing when you want to make this PC available.";Save(name);
    }return;
   }
   var body=new Dictionary<string,object>{{"enabled",enabled},{"ack",ack}};
   if(enabled&&active){int w,h;body["frame"]=CaptureScreen(out w,out h);body["width"]=w;body["height"]=h;}
   var result=await Request("poll",body);if(closing)return;bool nextActive=enabled&&Convert.ToBoolean(result["active"]);
   if(!nextActive)ReleaseAll();active=nextActive;
   if(active){status.Text="SHARING LIVE with Neon owner "+Convert.ToString(result["ownerName"])+". Click Stop sharing to end control.";}
   else status.Text=enabled?"Sharing enabled. Waiting for your owner account to connect.":"Sharing is off. No screen is being captured.";
   var commands=result["commands"] as object[];
   if(commands!=null)foreach(var value in commands){var command=value as Dictionary<string,object>;if(command==null)continue;long sequence=Convert.ToInt64(command["id"]);if(sequence<=ack)continue;if(enabled&&active)Apply(command);else ReleaseAll();ack=sequence;}
  }catch(Exception error){active=false;ReleaseAll();if(!closing)status.Text="Connection paused: "+error.Message;}
  finally{timer.Interval=active?750:paired?5000:2000;busy=false;}
 }
 string CaptureScreen(out int width,out int height){
  Rectangle screen=Screen.PrimaryScreen.Bounds;double scale=Math.Min(1.0,1280.0/Math.Max(screen.Width,screen.Height));width=Math.Max(1,(int)(screen.Width*scale));height=Math.Max(1,(int)(screen.Height*scale));
  using(var original=new Bitmap(screen.Width,screen.Height))using(var graphics=Graphics.FromImage(original)){
   graphics.CopyFromScreen(screen.Location,Point.Empty,screen.Size);using(var scaled=new Bitmap(width,height))using(var drawing=Graphics.FromImage(scaled))using(var output=new MemoryStream()){
    drawing.DrawImage(original,0,0,width,height);ImageCodecInfo codec=null;foreach(var item in ImageCodecInfo.GetImageEncoders())if(item.MimeType=="image/jpeg")codec=item;
    using(var parameters=new EncoderParameters(1)){parameters.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,55L);scaled.Save(output,codec,parameters);}return Convert.ToBase64String(output.ToArray());
   }
  }
 }
 void SendKey(int key,bool down){var input=new INPUT {type=1,value=new InputUnion {key=new KEYBDINPUT {vk=(ushort)key,flags=down?0U:2U}}};SendInput(1,new[]{input},Marshal.SizeOf(typeof(INPUT)));}
 void SendMouse(uint flags,int delta=0){var input=new INPUT {type=0,value=new InputUnion {mouse=new MOUSEINPUT {dwFlags=flags,mouseData=unchecked((uint)delta)}}};SendInput(1,new[]{input},Marshal.SizeOf(typeof(INPUT)));}
 void Apply(Dictionary<string,object> command){
  string type=Convert.ToString(command["type"]);if(type=="release"){ReleaseAll();return;}
  if(type=="key"){int key=Convert.ToInt32(command["key"]);bool down=Convert.ToBoolean(command["down"]);if(key<8||key>222)return;SendKey(key,down);if(down)heldKeys.Add(key);else heldKeys.Remove(key);return;}
  if(type=="text"){
   string text=Convert.ToString(command["text"]);if(text.Length>400)return;foreach(char ch in text){var a=new INPUT {type=1,value=new InputUnion {key=new KEYBDINPUT {scan=ch,flags=4}}};var b=a;b.value.key.flags=6;SendInput(2,new[]{a,b},Marshal.SizeOf(typeof(INPUT)));}return;
  }
  double x=Convert.ToDouble(command["x"]),y=Convert.ToDouble(command["y"]);if(x<0||x>1||y<0||y>1)return;var screen=Screen.PrimaryScreen.Bounds;SetCursorPos(screen.Left+(int)(x*(screen.Width-1)),screen.Top+(int)(y*(screen.Height-1)));
  if(type=="button"){int button=Convert.ToInt32(command["button"]);bool down=Convert.ToBoolean(command["down"]);uint[] pressed={2,32,8},released={4,64,16};if(button<0||button>2)return;SendMouse(down?pressed[button]:released[button]);if(down)heldButtons.Add(button);else heldButtons.Remove(button);}
  if(type=="wheel")SendMouse(2048,Math.Max(-1200,Math.Min(1200,Convert.ToInt32(command["delta"]))));
 }
 void ReleaseAll(){foreach(int key in heldKeys)SendKey(key,false);heldKeys.Clear();uint[] flags={4,64,16};foreach(int button in heldButtons)SendMouse(flags[button]);heldButtons.Clear();}
 void Save(string owner){
  Directory.CreateDirectory(Path.GetDirectoryName(saved));byte[] bytes=Encoding.UTF8.GetBytes(json.Serialize(new Dictionary<string,object>{{"credential",credential},{"owner",owner}}));File.WriteAllBytes(saved,ProtectedData.Protect(bytes,null,DataProtectionScope.CurrentUser));
 }
 void Restore(){
  if(!File.Exists(saved))return;try{var value=json.DeserializeObject(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(saved),null,DataProtectionScope.CurrentUser))) as Dictionary<string,object>;string token=Convert.ToString(value["credential"]);if(token.Length!=64)return;credential=token;paired=true;sharing.Enabled=true;account.Text="Linked to Neon owner: "+Convert.ToString(value["owner"]);pairCode.Text="PC paired · sharing is off";}catch{status.Text="Pair this PC again to restore its Neon connection.";}
 }
 [STAThread]public static void Main(string[] args){
  if(args.Length>0&&args[0]=="--self-test"){
   byte[] bytes=Encoding.UTF8.GetBytes("neon-launcher-test");byte[] protectedBytes=ProtectedData.Protect(bytes,null,DataProtectionScope.CurrentUser);if(Encoding.UTF8.GetString(ProtectedData.Unprotect(protectedBytes,null,DataProtectionScope.CurrentUser))!="neon-launcher-test")Environment.Exit(1);
   if(Marshal.SizeOf(typeof(INPUT))!=40&&Marshal.SizeOf(typeof(INPUT))!=28)Environment.Exit(2);return;
  }
  SetProcessDPIAware();Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new NeonLauncher());
 }
}
